import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/article", () => ({ extractArticle: vi.fn() }));
vi.mock("@/actions/capture", () => ({ importMarkdown: vi.fn() }));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, readingItems } from "@/db/schema";
import { extractArticle } from "@/lib/article";
import { importMarkdown } from "@/actions/capture";
import { deleteBlip } from "./blips";
import {
  addToReadingList,
  addUrlToReadingList,
  getReadingItem,
  listReadingItems,
  readingCounts,
  readingItemIdsByBlip,
  removeFromReadingList,
  retryExtraction,
  saveReadingProgress,
  setReadingStatus,
} from "./reading";

const now = new Date();
const seed = (id: string, url: string | null) =>
  db.insert(blips).values({ id, content: id, title: `Title ${id}`, url, status: "active", createdAt: now, updatedAt: now });
const article = (o: Record<string, unknown> = {}) => ({
  title: "Real Title",
  byline: "Jane Roe",
  siteName: "Example",
  excerpt: "An excerpt",
  leadImageUrl: "https://cdn.example.com/a.jpg",
  contentHtml: "<p>Body</p>",
  wordCount: 460,
  readingMinutes: 2,
  ...o,
});
const okResult = (o: Record<string, unknown> = {}) => ({ ok: true as const, article: article(o) });

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
beforeEach(() => vi.clearAllMocks());

describe("reading list", () => {
  it("saves the extracted article for a blip, once", async () => {
    vi.mocked(extractArticle).mockResolvedValue(okResult());
    await seed("b1", "https://example.com/a");
    const r = await addToReadingList("b1");
    expect(r).toMatchObject({ ok: true, extracted: true });
    const item = await getReadingItem((r as { id: string }).id);
    expect(item).toMatchObject({
      blipId: "b1",
      title: "Real Title",
      contentHtml: "<p>Body</p>",
      readingMinutes: 2,
      extractStatus: "ok",
      status: "unread",
    });
    const again = await addToReadingList("b1");
    expect(again).toMatchObject({ ok: true, id: (r as { id: string }).id });
    expect(extractArticle).toHaveBeenCalledTimes(1);
  });

  it("saves a failed extraction as a state with the reason, and retry can fix it", async () => {
    vi.mocked(extractArticle).mockResolvedValue({ ok: false, reason: "Paywalled" });
    await seed("b2", "https://example.com/paywalled");
    const r = (await addToReadingList("b2")) as { ok: true; id: string; extracted: boolean };
    expect(r.extracted).toBe(false);
    expect(await getReadingItem(r.id)).toMatchObject({
      extractStatus: "failed",
      extractError: "Paywalled",
      contentHtml: null,
      title: "Title b2",
    });
    expect(await retryExtraction(r.id)).toMatchObject({ ok: false });

    vi.mocked(extractArticle).mockResolvedValue(okResult({ title: "Now Works" }));
    expect(await retryExtraction(r.id)).toEqual({ ok: true });
    expect(await getReadingItem(r.id)).toMatchObject({ extractStatus: "ok", title: "Now Works", extractError: null });
  });

  it("a failed refresh keeps an earlier good copy", async () => {
    vi.mocked(extractArticle).mockResolvedValue(okResult());
    await seed("b3", "https://example.com/c");
    const r = (await addToReadingList("b3")) as { id: string };
    vi.mocked(extractArticle).mockResolvedValue({ ok: false, reason: "Down" });
    expect(await retryExtraction(r.id)).toMatchObject({ ok: false });
    expect(await getReadingItem(r.id)).toMatchObject({ extractStatus: "ok", contentHtml: "<p>Body</p>" });
  });

  it("rejects missing blips and blips without a link", async () => {
    await seed("nolink", null);
    expect(await addToReadingList("nope")).toMatchObject({ ok: false });
    expect(await addToReadingList("nolink")).toMatchObject({ ok: false });
  });

  it("pasting a link reuses an existing blip, or captures a new one first", async () => {
    vi.mocked(extractArticle).mockResolvedValue(okResult());
    await seed("b4", "https://example.com/known");
    const known = await addUrlToReadingList("https://example.com/known");
    expect(known).toMatchObject({ ok: true });
    expect(importMarkdown).not.toHaveBeenCalled();

    vi.mocked(importMarkdown).mockImplementation(async (md: string) => {
      const url = md.match(/\((.*)\)/)![1];
      await seed("b5", url);
      return { ok: true, created: 1, storedInSpaces: 0, skippedDuplicates: 0, groups: 0, usedAi: false, warnings: [] };
    });
    const fresh = await addUrlToReadingList("https://example.com/new");
    expect(fresh).toMatchObject({ ok: true });
    expect(importMarkdown).toHaveBeenCalledTimes(1);
    expect((await db.select().from(readingItems).where(eq(readingItems.blipId, "b5"))).length).toBe(1);

    expect(await addUrlToReadingList("not a url")).toMatchObject({ ok: false });
    expect(await addUrlToReadingList("ftp://example.com/x")).toMatchObject({ ok: false });
  });

  it("tracks status, lists by status and counts", async () => {
    const [first] = await listReadingItems("unread");
    expect(await setReadingStatus(first.id, "read")).toEqual({ ok: true });
    const item = await getReadingItem(first.id);
    expect(item?.status).toBe("read");
    expect(item?.readAt).toBeInstanceOf(Date);
    expect((await listReadingItems("read")).map((i) => i.id)).toContain(first.id);
    expect((await listReadingItems("unread")).map((i) => i.id)).not.toContain(first.id);
    const counts = await readingCounts();
    expect(counts.read).toBe(1);
    expect(await setReadingStatus(first.id, "unread")).toEqual({ ok: true });
    expect((await getReadingItem(first.id))?.readAt).toBeNull();
    expect(await setReadingStatus("missing", "read")).toMatchObject({ ok: false });
    // The list query never loads article bodies.
    expect(Object.keys((await listReadingItems())[0])).not.toContain("contentHtml");
  });

  it("maps blips to their reading items", async () => {
    const map = await readingItemIdsByBlip(["b1", "nolink"]);
    expect(Object.keys(map)).toEqual(["b1"]);
    expect(await readingItemIdsByBlip([])).toEqual({});
  });

  it("removing an item keeps the blip; deleting the blip purges the item", async () => {
    const id = (await readingItemIdsByBlip(["b1"])).b1;
    await removeFromReadingList(id);
    expect(await getReadingItem(id)).toBeNull();
    expect((await db.select().from(blips).where(eq(blips.id, "b1"))).length).toBe(1);

    const id3 = (await readingItemIdsByBlip(["b3"])).b3;
    await deleteBlip("b3");
    expect(await getReadingItem(id3)).toBeNull();
  });

  it("fizzling a blip does not delete its reading item", async () => {
    const id = (await readingItemIdsByBlip(["b4"])).b4;
    await db.update(blips).set({ status: "fizzled" }).where(eq(blips.id, "b4"));
    expect(await getReadingItem(id)).not.toBeNull();
  });

  it("saves scroll progress; the first real scroll moves unread to reading", async () => {
    vi.mocked(extractArticle).mockResolvedValue(okResult());
    await seed("p1", "https://example.com/progress");
    const id = ((await addToReadingList("p1")) as { id: string }).id;
    expect(await saveReadingProgress(id, 0.005)).toMatchObject({ ok: true, status: "unread", saved: true });
    expect((await getReadingItem(id))?.scrollPct).toBeCloseTo(0.005);
    expect(await saveReadingProgress(id, 0.4)).toMatchObject({ ok: true, status: "reading" });
    expect(await getReadingItem(id)).toMatchObject({ status: "reading", scrollPct: 0.4 });
    // out-of-range values are clamped, bad ones rejected
    await saveReadingProgress(id, 7);
    expect((await getReadingItem(id))?.scrollPct).toBe(1);
    expect(await saveReadingProgress(id, Number.NaN)).toMatchObject({ ok: false });
    expect(await saveReadingProgress("missing", 0.5)).toMatchObject({ ok: false });
    // finishing is explicit: scrolling to the end does not mark it read
    expect((await getReadingItem(id))?.status).toBe("reading");
    const counts = await readingCounts();
    expect(counts.reading).toBeGreaterThanOrEqual(1);
  });

  it("does not overwrite progress on a finished article, and Unread starts over", async () => {
    const id = (await readingItemIdsByBlip(["p1"])).p1;
    await setReadingStatus(id, "read");
    expect(await saveReadingProgress(id, 0.1)).toMatchObject({ ok: true, status: "read", saved: false });
    expect((await getReadingItem(id))?.scrollPct).toBe(1);
    await setReadingStatus(id, "unread");
    expect((await getReadingItem(id))?.scrollPct).toBe(0);
  });
});
