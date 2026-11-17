import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const blipStatuses = ["active", "matured", "fizzled"] as const;
export type BlipStatus = (typeof blipStatuses)[number];

// Specialized spaces render and intake differently. Add new kinds here.
export const spaceKinds = ["general", "video", "book", "code"] as const;
export type SpaceKind = (typeof spaceKinds)[number];

// How a blip was auto-routed into a space at capture (null = stored by hand).
export const routedByValues = ["rule", "group", "ai"] as const;
export type RoutedBy = (typeof routedByValues)[number];

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
  // Why the blip was auto-routed (shown with the "Auto-sorted" note); null when stored by hand.
  routedReason: text("routed_reason"),
  status: text("status", { enum: blipStatuses }).notNull().default("active"),
  nextReviewAt: integer("next_review_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Audit log of capture/reprocess routing decisions. Denormalized (no FKs) so
// entries survive blip or space deletion and renames.
export const routingEvents = sqliteTable("routing_events", {
  id: text("id").primaryKey(),
  blipId: text("blip_id").notNull(),
  blipTitle: text("blip_title").notNull(),
  url: text("url"),
  spaceId: text("space_id"),
  spaceName: text("space_name"),
  // null = no route found; the blip stayed in the feed.
  routedBy: text("routed_by", { enum: routedByValues }),
  reason: text("reason").notNull(),
  source: text("source", { enum: ["capture", "reprocess", "reroute"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Book metadata for blips in a book space (1:1 with blips). The cover lives in
// blips.image_url and the title in blips.title.
export const bookLookupStatuses = ["ok", "partial", "failed"] as const;
export type BookLookupStatus = (typeof bookLookupStatuses)[number];
export const repoProviders = ["github", "gitlab", "bitbucket", "codeberg", "sourcehut"] as const;
export const repoLookupStatuses = ["ok", "failed"] as const;

// Details for a blip stored in a code space (1:1, cascade-deleted with the blip).
export const repoDetails = sqliteTable("repo_details", {
  blipId: text("blip_id")
    .primaryKey()
    .references(() => blips.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: repoProviders }).notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  stars: integer("stars"),
  language: text("language"),
  // JSON array of topic names.
  topics: text("topics").notNull().default("[]"),
  license: text("license"),
  homepage: text("homepage"),
  pushedAt: integer("pushed_at", { mode: "timestamp" }),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  // First paragraph of the README. null = not fetched yet (retried); "" = the repo has none.
  readmeExcerpt: text("readme_excerpt"),
  // ok = details fetched; failed = repo not found / host has no API (retry from the card).
  lookupStatus: text("lookup_status", { enum: repoLookupStatuses }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const readingStatuses = ["unread", "reading", "read", "archived"] as const;
export type ReadingStatus = (typeof readingStatuses)[number];
export const extractStatuses = ["ok", "failed"] as const;

// A saved, readable copy of an article. Separate from spaces; deleted with its blip.
export const readingItems = sqliteTable("reading_items", {
  id: text("id").primaryKey(),
  blipId: text("blip_id")
    .notNull()
    .unique()
    .references(() => blips.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  byline: text("byline"),
  siteName: text("site_name"),
  leadImageUrl: text("lead_image_url"),
  excerpt: text("excerpt"),
  // Sanitized article HTML (see src/lib/article.ts); null when extraction failed.
  contentHtml: text("content_html"),
  wordCount: integer("word_count"),
  readingMinutes: integer("reading_minutes"),
  // How far down the article you got (0 to 1), restored when you reopen it.
  scrollPct: real("scroll_pct").notNull().default(0),
  extractStatus: text("extract_status", { enum: extractStatuses }).notNull(),
  extractError: text("extract_error"),
  status: text("status", { enum: readingStatuses }).notNull().default("unread"),
  addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
  readAt: integer("read_at", { mode: "timestamp" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

export const highlightColors = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof highlightColors)[number];

// A passage highlighted in a saved article, anchored by its text and surrounding words
// (not by position), so it can be found again in the same stored text. Deleted with the item.
export const readingHighlights = sqliteTable("reading_highlights", {
  id: text("id").primaryKey(),
  readingItemId: text("reading_item_id")
    .notNull()
    .references(() => readingItems.id, { onDelete: "cascade" }),
  exact: text("exact").notNull(),
  prefix: text("prefix").notNull().default(""),
  suffix: text("suffix").notNull().default(""),
  note: text("note"),
  color: text("color", { enum: highlightColors }).notNull().default("yellow"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const bookDetails = sqliteTable("book_details", {
  blipId: text("blip_id")
    .primaryKey()
    .references(() => blips.id, { onDelete: "cascade" }),
  isbn13: text("isbn13"),
  // JSON array of author names.
  authors: text("authors").notNull().default("[]"),
  publisher: text("publisher"),
  publishedYear: integer("published_year"),
  pageCount: integer("page_count"),
  // ok = exact ISBN match; partial = matched by title; failed = no usable match (retry from the card).
  lookupStatus: text("lookup_status", { enum: bookLookupStatuses }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

// User-defined "links from this site go to this space" rules, checked first at capture.
export const routingRules = sqliteTable("routing_rules", {
  id: text("id").primaryKey(),
  // Normalized: lowercase host (no scheme or www), optional path prefix, e.g. "github.com/vercel".
  pattern: text("pattern").notNull().unique(),
  spaceId: text("space_id")
    .notNull()
    .references(() => spaces.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Space = typeof spaces.$inferSelect;
export type BlipGroup = typeof blipGroups.$inferSelect;
export type Blip = typeof blips.$inferSelect;
export type NewBlip = typeof blips.$inferInsert;
export type RoutingEvent = typeof routingEvents.$inferSelect;
export type RoutingRule = typeof routingRules.$inferSelect;
export type BookDetails = typeof bookDetails.$inferSelect;
export type RepoDetails = typeof repoDetails.$inferSelect;
export type ReadingItem = typeof readingItems.$inferSelect;
export type ReadingHighlight = typeof readingHighlights.$inferSelect;
