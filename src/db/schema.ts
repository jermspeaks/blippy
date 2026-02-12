import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const blipStatuses = ["active", "matured", "fizzled"] as const;
export type BlipStatus = (typeof blipStatuses)[number];

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const blips = sqliteTable("blips", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  status: text("status", { enum: blipStatuses }).notNull().default("active"),
  nextReviewAt: integer("next_review_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Blip = typeof blips.$inferSelect;
export type NewBlip = typeof blips.$inferInsert;
