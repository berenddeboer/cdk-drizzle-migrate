import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./schema.ts",
  out: "./migrations",
  dialect: "postgresql", // Specify the dialect explicitly
  dbCredentials: {
    // These values don't matter for migration generation
    // They're only used when actually connecting to a database
    host: "localhost",
    user: "postgres",
    password: "password",
    database: "testdb",
  },
})
