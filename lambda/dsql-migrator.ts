import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import type postgres from "postgres"

/**
 * Migration metadata structure compatible with Drizzle's format
 */
interface MigrationMeta {
  sql: string[]
  folderMillis: number
  hash: string
  bps: boolean
  name: string
}

/**
 * Configuration for DSQL migrations
 */
interface DSQLMigrationConfig {
  migrationsFolder: string
  migrationsTable?: string
  migrationsSchema?: string
}

const DSQL_RETRYABLE_SQLSTATE = "40001"
const DSQL_RETRYABLE_ERROR_CODE = "OC001"
const DSQL_MAX_RETRY_ATTEMPTS = 8
const DSQL_INITIAL_RETRY_DELAY_MS = 200
const DSQL_MAX_RETRY_DELAY_MS = 5_000

/**
 * Convert a Drizzle 1.0 timestamp prefix (YYYYMMDDHHMMSS) to milliseconds.
 */
function formatToMillis(dateStr: string): number {
  const year = parseInt(dateStr.slice(0, 4), 10)
  const month = parseInt(dateStr.slice(4, 6), 10) - 1
  const day = parseInt(dateStr.slice(6, 8), 10)
  const hour = parseInt(dateStr.slice(8, 10), 10)
  const minute = parseInt(dateStr.slice(10, 12), 10)
  const second = parseInt(dateStr.slice(12, 14), 10)

  return Date.UTC(year, month, day, hour, minute, second)
}

/**
 * Read migration files from the specified Drizzle 1.0 migration folder.
 */
function readMigrationFiles(config: DSQLMigrationConfig): MigrationMeta[] {
  const migrationsFolder = path.resolve(config.migrationsFolder)
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json")

  if (fs.existsSync(journalPath)) {
    throw new Error(
      'We detected that you have old drizzle-kit migration folders. You must upgrade drizzle-kit and run "drizzle-kit up"'
    )
  }

  const migrations = fs
    .readdirSync(migrationsFolder)
    .map((subdir) => ({
      path: path.join(migrationsFolder, subdir, "migration.sql"),
      name: subdir,
    }))
    .filter((migration) => fs.existsSync(migration.path))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((migration): MigrationMeta => {
      const migrationPath = migration.path
      const migrationDate = migration.name.slice(0, 14)
      const migrationContent = fs.readFileSync(migrationPath, "utf8")
      const statements = migrationContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean)

      return {
        sql: statements,
        folderMillis: formatToMillis(migrationDate),
        hash: crypto.createHash("sha256").update(migrationContent).digest("hex"),
        bps: true,
        name: migration.name,
      }
    })

  return migrations
}

function isRetryableDsqlError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeError = error as {
    code?: unknown
    message?: unknown
    detail?: unknown
    cause?: unknown
  }

  if (maybeError.code === DSQL_RETRYABLE_SQLSTATE) {
    return true
  }

  const text = [maybeError.message, maybeError.detail]
    .filter((value): value is string => typeof value === "string")
    .join(" ")

  if (text.includes(DSQL_RETRYABLE_ERROR_CODE)) {
    return true
  }

  return isRetryableDsqlError(maybeError.cause)
}

function isMissingMigrationsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const maybeError = error as { code?: unknown }
  return maybeError.code === "42P01" || maybeError.code === "3F000"
}

function getRetryDelayMs(attempt: number): number {
  return Math.min(
    DSQL_INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
    DSQL_MAX_RETRY_DELAY_MS
  )
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function withDsqlRetry<T>(action: string, operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= DSQL_MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isRetryableDsqlError(error) || attempt === DSQL_MAX_RETRY_ATTEMPTS) {
        throw error
      }

      const delayMs = getRetryDelayMs(attempt)
      console.warn(
        `${action} hit a retryable Aurora DSQL schema conflict on attempt ${attempt}/${DSQL_MAX_RETRY_ATTEMPTS}. Retrying in ${delayMs}ms.`
      )
      await sleep(delayMs)
    }
  }

  throw new Error(`${action} exceeded the maximum Aurora DSQL retry attempts`)
}

/**
 * Create the DSQL-compatible migrations table
 */
async function ensureMigrationsTable(
  sql: postgres.Sql,
  config: DSQLMigrationConfig
): Promise<void> {
  const schema = config.migrationsSchema || "drizzle"
  const table = config.migrationsTable || "__drizzle_migrations"

  // Create schema if it doesn't exist
  await withDsqlRetry(
    "Creating DSQL migrations schema",
    () => sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`
  )

  // Create migrations table with UUID instead of SERIAL
  await withDsqlRetry(
    "Creating DSQL migrations table",
    () =>
      sql`CREATE TABLE IF NOT EXISTS ${sql(schema)}.${sql(table)} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hash text NOT NULL UNIQUE,
      created_at bigint NOT NULL
    )`
  )
}

/**
 * Get list of already applied migration hashes
 */
async function getAppliedMigrations(
  sql: postgres.Sql,
  config: DSQLMigrationConfig
): Promise<Set<string>> {
  const schema = config.migrationsSchema || "drizzle"
  const table = config.migrationsTable || "__drizzle_migrations"

  try {
    const result = await withDsqlRetry(
      "Reading applied DSQL migrations",
      () => sql`SELECT hash FROM ${sql(schema)}.${sql(table)}`
    )
    return new Set(result.map((row) => row.hash as string))
  } catch (error) {
    if (isMissingMigrationsTableError(error)) {
      console.warn(
        "Could not query migrations table because it does not exist yet:",
        error
      )
      return new Set()
    }

    throw error
  }
}

/**
 * Execute a single migration and record it
 */
async function executeMigration(
  sql: postgres.Sql,
  migration: MigrationMeta,
  config: DSQLMigrationConfig
): Promise<void> {
  const schema = config.migrationsSchema || "drizzle"
  const table = config.migrationsTable || "__drizzle_migrations"

  console.log(`Executing migration with hash: ${migration.hash}`)

  try {
    // Execute all SQL statements in the migration
    for (const [index, statement] of migration.sql.entries()) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 100)}...`)
        await withDsqlRetry(
          `Executing DSQL migration ${migration.hash} statement ${index + 1}`,
          () => sql.unsafe(statement, [], { prepare: false })
        )
      }
    }

    // Record successful migration
    await withDsqlRetry(
      `Recording DSQL migration ${migration.hash}`,
      () =>
        sql`INSERT INTO ${sql(schema)}.${sql(table)} (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`
    )

    console.log(`Migration ${migration.hash} completed successfully`)
  } catch (error) {
    console.error(`Migration ${migration.hash} failed:`, error)
    throw error
  }
}

/**
 * Main DSQL migration function
 * This replaces Drizzle's migrate function for DSQL compatibility
 */
export async function migrateDSQL(
  sql: postgres.Sql,
  config: DSQLMigrationConfig
): Promise<void> {
  console.log(`Starting DSQL migration from ${config.migrationsFolder}`)

  // Ensure the migrations table exists with proper DSQL-compatible schema
  await ensureMigrationsTable(sql, config)

  // Read all migration files
  const migrations = readMigrationFiles(config)
  console.log(`Found ${migrations.length} migration files`)

  // Get already applied migrations
  const appliedMigrations = await getAppliedMigrations(sql, config)
  console.log(`Found ${appliedMigrations.size} already applied migrations`)

  // Filter out already applied migrations
  const pendingMigrations = migrations.filter((m) => !appliedMigrations.has(m.hash))
  console.log(`${pendingMigrations.length} migrations pending`)

  if (pendingMigrations.length === 0) {
    console.log("No pending migrations to apply")
    return
  }

  // Execute pending migrations in order
  for (const migration of pendingMigrations) {
    await executeMigration(sql, migration, config)
  }

  console.log("All migrations completed successfully")
}
