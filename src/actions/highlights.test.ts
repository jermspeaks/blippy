import { describe, it, expect, vi, beforeAll } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, readingHighlights, readingItems } from "@/db/schema";
import { createHighlight, deleteHighlight, listHighlights, updateHighlight } from "./highlights";
import { removeFromReadingList } from "./reading";

const now = new Date();
beforeAll(async () => {
  migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(blips).values({ id: "b", content: "b", url: "https://e.com/a", status: "active", createdAt: now, updatedAt: now });
  await db.insert(readingItems).values({
    id: "item", blipId: "b", url: "https://e.com/a", title: "T", contentHtml: "<p>Body</p>",
    extractStatus: "ok", addedAt: now, fetchedAt: now,
  });
});

const base = { readingItemId: "item", exact: "a passage", prefix: "before ", suffix: " after" };

describe("highlights", () => {
  it("creates a highlight with defaults and lists it", async () => {
    const r = await createHighlight(base);
    expect(r).toMatchObject({ ok: true, highlight: { exact: "a passage", color: "yellow", note: null, prefix: "before " } });
    expect(await listHighlights("item")).toHaveLength(1);
  });

  it("saves a trimmed note and a color; blank notes become none", async () => {
    const withNote = await createHighlight({ ...base, note: "  worth rereading  ", color: "pink" });
    expect(withNote).toMatchObject({ ok: true, highlight: { note: "worth rereading", color: "pink" } });
    const blank = await createHighlight({ ...base, note: "   " });
    expect(blank).toMatchObject({ ok: true, highlight: { note: null } });
  });

  it("rejects bad input and unknown articles", async () => {
    expect(await createHighlight({ ...base, exact: "" })).toMatchObject({ ok: false });
    expect(await createHighlight({ ...base, exact: "x".repeat(2001) })).toMatchObject({ ok: false });
    expect(await createHighlight({ ...base, color: "red" as never })).toMatchObject({ ok: false });
    expect(await createHighlight({ ...base, readingItemId: "nope" })).toMatchObject({ ok: false });
  });

  it("updates note and color, and deletes", async () => {
    const [h] = await listHighlights("item");
    const upd = await updateHighlight(h.id, { note: "new note", color: "blue" });
    expect(upd).toMatchObject({ ok: true, highlight: { note: "new note", color: "blue" } });
    expect(await updateHighlight(h.id, { note: null, color: "purple" })).toMatchObject({ ok: false });
    expect(await updateHighlight("missing", { note: null, color: "blue" })).toMatchObject({ ok: false });
    await deleteHighlight(h.id);
    expect((await listHighlights("item")).map((x) => x.id)).not.toContain(h.id);
  });

  it("deleting the article deletes its highlights", async () => {
    expect((await listHighlights("item")).length).toBeGreaterThan(0);
    await removeFromReadingList("item");
    expect(await db.select().from(readingHighlights).where(eq(readingHighlights.readingItemId, "item"))).toHaveLength(0);
  });
});
