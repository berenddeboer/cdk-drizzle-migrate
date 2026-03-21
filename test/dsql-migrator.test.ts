import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { migrateDSQL } from "../lambda/dsql-migrator"

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "raw")
}

describe("migrateDSQL", () => {
  let tempDir: string
  let migrationsDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsql-migrator-"))
    migrationsDir = path.join(tempDir, "migrations")
    fs.mkdirSync(path.join(migrationsDir, "meta"), { recursive: true })

    fs.writeFileSync(
      path.join(migrationsDir, "meta", "_journal.json"),
      JSON.stringify({
        entries: [
          {
            tag: "0000_initial",
            when: 1,
            breakpoints: true,
          },
        ],
      })
    )

    fs.writeFileSync(
      path.join(migrationsDir, "0000_initial.sql"),
      [
        "CREATE TABLE example (id int);",
        "--> statement-breakpoint",
        "ALTER TABLE example ADD COLUMN name text;",
      ].join("\n")
    )

    jest.spyOn(console, "log").mockImplementation(() => undefined)
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test("retries retryable DSQL schema conflicts during reads, statements and inserts", async () => {
    const callCounts = {
      createSchema: 0,
      createTable: 0,
      select: 0,
      insert: 0,
      alterTable: 0,
    }
    const executedStatements: string[] = []

    const sql = ((first: unknown) => {
      if (!isTemplateStringsArray(first)) {
        return { identifier: first }
      }

      const queryText = first.join("?")

      if (queryText.includes("CREATE SCHEMA IF NOT EXISTS")) {
        callCounts.createSchema += 1
        return Promise.resolve([])
      }

      if (queryText.includes("CREATE TABLE IF NOT EXISTS")) {
        callCounts.createTable += 1
        return Promise.resolve([])
      }

      if (queryText.includes("SELECT hash FROM")) {
        callCounts.select += 1

        if (callCounts.select === 1) {
          return Promise.reject(
            Object.assign(new Error("serialization failure"), { code: "40001" })
          )
        }

        return Promise.resolve([])
      }

      if (queryText.includes("INSERT INTO")) {
        callCounts.insert += 1

        if (callCounts.insert === 1) {
          return Promise.reject(
            new Error(
              "schema has been updated by another transaction, please retry (OC001)"
            )
          )
        }

        return Promise.resolve([])
      }

      return Promise.resolve([])
    }) as any

    sql.unsafe = jest.fn(async (statement: string) => {
      executedStatements.push(statement)

      if (statement.includes("ALTER TABLE")) {
        callCounts.alterTable += 1

        if (callCounts.alterTable === 1) {
          throw new Error(
            "schema has been updated by another transaction, please retry (OC001)"
          )
        }
      }

      return []
    })

    await migrateDSQL(sql, { migrationsFolder: migrationsDir })

    expect(callCounts.createSchema).toBe(1)
    expect(callCounts.createTable).toBe(1)
    expect(callCounts.select).toBe(2)
    expect(callCounts.insert).toBe(2)
    expect(callCounts.alterTable).toBe(2)
    expect(executedStatements).toEqual([
      "CREATE TABLE example (id int);",
      "ALTER TABLE example ADD COLUMN name text;",
      "ALTER TABLE example ADD COLUMN name text;",
    ])
    expect(sql.unsafe).toHaveBeenNthCalledWith(1, "CREATE TABLE example (id int);", [], {
      prepare: false,
    })
    expect(sql.unsafe).toHaveBeenNthCalledWith(
      2,
      "ALTER TABLE example ADD COLUMN name text;",
      [],
      { prepare: false }
    )
  })
})
