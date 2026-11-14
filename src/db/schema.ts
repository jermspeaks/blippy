import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const blipStatuses = ["active", "matured", "fizzled"] as const;
export type BlipStatus = (typeof blipStatuses)[number];

// Specialized spaces render and intake differently. Add new kinds here.
export const spaceKinds = ["general", "video"] as const;
export type SpaceKind = (typeof spaceKinds)[number];

// How a blip was auto-routed into a space at capture (null = stored by hand).
export const routedByValues = ["rule", "group", "ai"] as const;
export type RoutedBy = (typeof routedByValues)[number];

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind", { enum: spaceKinds }).notNull().default("general"),
  // When true, blips whose topic group is linked to this space are stored here on import.
  autoIntake: integer("auto_intake", { mode: "boolean" }).notNull().default(true),
  // When false, the AI never routes new links here (rules and linked groups still do).
  aiRouting: integer("ai_routing", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const blipGroups = sqliteTable("blip_groups", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  // A group belongs to at most one space; a space can hold many groups.
  spaceId: text("space_id").references(() => spaces.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const blips = sqliteTable("blips", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  // Link-card fields (populated by markdown import; null for plain blips)
  title: text("title"),
  summary: text("summary"),
  imageUrl: text("image_url"),
  url: text("url"),
  siteName: text("site_name"),
  groupId: text("group_id").references(() => blipGroups.id),
  // Stored blips leave the feed and live in a space.
  spaceId: text("space_id").references(() => spaces.id),
  routedBy: text("routed_by", { enum: routedByValues }),
  status: text("status", { enum: blipStatuses }).notNull().default("active"),
  nextReviewAt: integer("next_review_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type BlipGroup = typeof blipGroups.$inferSelect;
export type Blip = typeof blips.$inferSelect;
export type NewBlip = typeof blips.$inferInsert;
