import { mysqlTable, int, text, timestamp } from "drizzle-orm/mysql-core"

// Define a simple products table
export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const invoices = mysqlTable("invoices", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  description: text("description"),
  total: text("total"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
