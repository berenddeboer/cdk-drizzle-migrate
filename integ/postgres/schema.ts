import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

// Define a simple products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
