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
}

/**
 * Configuration for DSQL migrations
 */
interface DSQLMigrationConfig {
  migrationsFolder: string
  migrationsTable?: string
  migrationsSchema?: string
}

/**
 * Read migration files from the specified folder
 * This replicates Drizzle's readMigrationFiles function
 */
function readMigrationFiles(config: DSQLMigrationConfig): MigrationMeta[] {
  const migrationsFolder = path.resolve(config.migrationsFolder)
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json")
  
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json file`)
  }

  const journalContent = fs.readFileSync(journalPath, "utf8")
  const journal = JSON.parse(journalContent)

  const migrations: MigrationMeta[] = []
  
  for (const entry of journal.entries) {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`)
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Can't find migration file ${migrationPath}`)
    }

    const migrationContent = fs.readFileSync(migrationPath, "utf8")
    const statements = migrationContent.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)
    
    // Generate hash of the migration content
    const hash = crypto.createHash("sha256").update(migrationContent).digest("hex")
    
    migrations.push({
      sql: statements,
      folderMillis: entry.when,
      hash,
      bps: entry.breakpoints || false
    })
  }

  return migrations.sort((a, b) => a.folderMillis - b.folderMillis)
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
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`
  
  // Create migrations table with UUID instead of SERIAL
  await sql`CREATE TABLE IF NOT EXISTS ${sql(schema)}.${sql(table)} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash text NOT NULL UNIQUE,
    created_at bigint NOT NULL
  )`
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
    const result = await sql`SELECT hash FROM ${sql(schema)}.${sql(table)}`
    return new Set(result.map(row => row.hash as string))
  } catch (error) {
    // If table doesn't exist yet, return empty set
    console.warn("Could not query migrations table:", error)
    return new Set()
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
    for (const statement of migration.sql) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 100)}...`)
        await sql.unsafe(statement)
      }
    }
    
    // Record successful migration
    await sql`INSERT INTO ${sql(schema)}.${sql(table)} (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`
    
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
  const pendingMigrations = migrations.filter(m => !appliedMigrations.has(m.hash))
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