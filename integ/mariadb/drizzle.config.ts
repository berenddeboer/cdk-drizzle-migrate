import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./schema.ts",
  out: "./migrations",
  dialect: "mysql",
  dbCredentials: {
    // These values don't matter for migration generation
    // They're only used when actually connecting to a database
    host: "localhost",
    user: "root",
    password: "password",
    database: "testdb",
  },
})
