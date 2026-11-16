import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/book-lookup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/book-lookup")>()),
  lookupByIsbn: vi.fn(),
  lookupByTitle: vi.fn(),
  searchBooks: vi.fn(),
}));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, bookDetails, spaces } from "@/db/schema";
import { lookupByIsbn, lookupByTitle } from "@/lib/book-lookup";
import { hydratePendingBooks, pendingBookBlips } from "./book-hydrate";
import { ensureBookSpace, sweepBookBlips } from "./book-space";
import { addBook, refreshBook, updateBook } from "@/actions/books";
import { convertSpaceToBook } from "@/actions/spaces";

const now = new Date();
const seed = (id: string, url: string | null, extra: Partial<typeof blips.$inferInsert> = {}) =>
  db.insert(blips).values({ id, content: id, title: id, url, status: "active", createdAt: now, updatedAt: now, ...extra });
const book = (o: Record<string, unknown> = {}) => ({
  title: "Atomic Habits",
  subtitle: null,
  authors: ["James Clear"],
  isbn13: "9780735211292",
  publisher: "Penguin",
  publishedYear: 2018,
  pageCount: 321,
  description: "A book about habits",
  coverUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
  infoUrl: "https://books.google.com/books?vid=ISBN9780735211292",
  ...o,
});
const detailsOf = async (id: string) =>
  (await db.select().from(bookDetails).where(eq(bookDetails.blipId, id)))[0];
const blipOf = async (id: string) => (await db.select().from(blips).where(eq(blips.id, id)))[0];

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
beforeEach(() => vi.clearAllMocks());

describe("book space", () => {
  it("adopts an existing general space named Books instead of duplicating it", async () => {
    await db.insert(spaces).values({ id: "sp-books", name: "books", kind: "general", autoIntake: true, aiRouting: true, createdAt: now });
    const s = ensureBookSpace(db)!;
    expect(s.id).toBe("sp-books");
    expect(s.kind).toBe("book");
    expect((await db.select().from(spaces)).filter((x) => x.kind === "book")).toHaveLength(1);
    expect(ensureBookSpace(db)!.id).toBe("sp-books");
  });

  it("returns null when the book space has auto-intake off", async () => {
    await db.update(spaces).set({ autoIntake: false }).where(eq(spaces.id, "sp-books"));
    expect(ensureBookSpace(db)).toBeNull();
    await db.update(spaces).set({ autoIntake: true }).where(eq(spaces.id, "sp-books"));
  });

  it("sweeps only real book links", async () => {
    await seed("sw1", "https://www.goodreads.com/book/show/123715.Slack");
    await seed("sw2", "https://www.amazon.com/dp/0735211299");
    await seed("sw3", "https://www.amazon.com/dp/B08N5WRWNW");
    await seed("sw4", null);
    expect(sweepBookBlips(db, "sp-books")).toBe(2);
    expect((await blipOf("sw1")).spaceId).toBe("sp-books");
    expect((await blipOf("sw3")).spaceId).toBeNull();
  });
});

describe("hydrating book details", () => {
  it("fills title, cover and details from an exact ISBN match", async () => {
    vi.mocked(lookupByIsbn).mockResolvedValue(book());
    await seed("h1", "https://www.amazon.com/dp/0735211299", { spaceId: "sp-books", title: "amazon page", summary: null });
    const counts = await hydratePendingBooks(25, "sp-books");
    expect(counts.ok).toBeGreaterThanOrEqual(1);
    expect(lookupByIsbn).toHaveBeenCalledWith("9780735211292");
    expect(await blipOf("h1")).toMatchObject({
      title: "Atomic Habits",
      imageUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
      summary: "A book about habits",
    });
    expect(await detailsOf("h1")).toMatchObject({
      isbn13: "9780735211292",
      lookupStatus: "ok",
      authors: JSON.stringify(["James Clear"]),
      publishedYear: 2018,
    });
  });

  it("records partial for title matches and failed (leaving the blip alone) for no match", async () => {
    vi.mocked(lookupByTitle).mockImplementation(async (t) =>
      t === "The Thinking Machine" ? book({ title: "The Thinking Machine", isbn13: "9780593832707" }) : null
    );
    await seed("h2", "https://www.penguinrandomhouse.com/books/757558/x/", { spaceId: "sp-books", title: "The Thinking Machine" });
    await seed("h3", "https://en.wikipedia.org/wiki/Some_Page", { spaceId: "sp-books", title: "Some Page", imageUrl: "https://x/y.png" });
    await hydratePendingBooks(25, "sp-books");
    expect((await detailsOf("h2")).lookupStatus).toBe("partial");
    expect((await detailsOf("h3")).lookupStatus).toBe("failed");
    expect(await blipOf("h3")).toMatchObject({ title: "Some Page", imageUrl: "https://x/y.png" });
  });

  it("on non-book sites, only accepts a title match the page gives evidence for", async () => {
    vi.mocked(lookupByTitle).mockImplementation(async (_t, _d, accept) => {
      const cand = book({ title: "Story Club", authors: ["Cathy Agin"] });
      return !accept || accept(cand) ? cand : null;
    });
    await seed("e1", "https://example.org/story-club", { spaceId: "sp-books", title: "Story Club", summary: "George Saunders' newsletter", imageUrl: "https://x/orig.png" });
    await seed("e2", "https://example.org/story-club-2", { spaceId: "sp-books", title: "Story Club", summary: "by Cathy Agin" });
    await hydratePendingBooks(25, "sp-books");
    expect((await detailsOf("e1")).lookupStatus).toBe("failed");
    expect(await blipOf("e1")).toMatchObject({ title: "Story Club", imageUrl: "https://x/orig.png" });
    expect((await detailsOf("e2")).lookupStatus).toBe("partial");
  });

  it("survives a lookup that throws", async () => {
    vi.mocked(lookupByTitle).mockRejectedValue(new Error("network"));
    await seed("h4", "https://example.com/x", { spaceId: "sp-books", title: "Whatever" });
    const counts = await hydratePendingBooks(25, "sp-books");
    expect(counts.deferred).toBe(1);
    // Nothing is recorded, so a later run retries it.
    expect(await detailsOf("h4")).toBeUndefined();
    expect(pendingBookBlips(25, "sp-books").map((b) => b.id)).toContain("h4");
  });

  it("a URL that carries an ISBN qualifies without any API match", async () => {
    vi.mocked(lookupByIsbn).mockResolvedValue(null);
    await seed("i1", "https://us.macmillan.com/books/9781250178602/x", { spaceId: "sp-books", title: "Macmillan page" });
    await hydratePendingBooks(25, "sp-books");
    expect(vi.mocked(lookupByTitle).mock.calls.map((c) => c[0])).not.toContain("Macmillan page");
    expect(await detailsOf("i1")).toMatchObject({ isbn13: "9781250178602", lookupStatus: "ok" });
    expect(await blipOf("i1")).toMatchObject({ title: "Macmillan page", spaceId: "sp-books" });
  });

  it("does not look up the same blip twice, and refresh retries and replaces", async () => {
    await db.insert(bookDetails).values({ blipId: "h4", authors: "[]", lookupStatus: "failed", fetchedAt: now });
    vi.mocked(lookupByTitle).mockResolvedValue(null);
    await hydratePendingBooks(25, "sp-books");
    expect(lookupByTitle).not.toHaveBeenCalled();

    vi.mocked(lookupByTitle).mockResolvedValue(book({ title: "Whatever" }));
    const r = await refreshBook("h4");
    expect(r).toEqual({ ok: true, found: true });
    expect((await detailsOf("h4")).lookupStatus).toBe("partial");
  });

  it("a failed refresh keeps earlier good details", async () => {
    vi.mocked(lookupByIsbn).mockResolvedValue(null);
    vi.mocked(lookupByTitle).mockResolvedValue(null);
    const r = await refreshBook("h1");
    expect(r).toEqual({ ok: true, found: false });
    expect((await detailsOf("h1")).lookupStatus).toBe("ok");
  });
});

describe("add book and convert", () => {
  it("adds a candidate once and rejects a duplicate ISBN", async () => {
    const first = await addBook("sp-books", book({ isbn13: "9781982182977", title: "Anatomy of a Breakthrough", infoUrl: "https://books.google.com/books?vid=ISBN9781982182977" }));
    expect(first.ok).toBe(true);
    const dupe = await addBook("sp-books", book({ isbn13: "9781982182977", title: "Anatomy of a Breakthrough", infoUrl: null }));
    expect(dupe).toMatchObject({ ok: false });
    if (first.ok) expect(await detailsOf(first.id)).toMatchObject({ lookupStatus: "ok", isbn13: "9781982182977" });
  });

  it("rejects non-book spaces and bad candidates", async () => {
    await db.insert(spaces).values({ id: "sp-gen", name: "Gen", kind: "general", autoIntake: true, aiRouting: true, createdAt: now });
    expect(await addBook("sp-gen", book())).toMatchObject({ ok: false, error: "Not a book space" });
    expect(await addBook("sp-books", book({ coverUrl: "http://insecure/x.png" }))).toMatchObject({ ok: false });
    expect(await addBook("sp-books", book({ title: "" }))).toMatchObject({ ok: false });
  });

  it("converts a general space once, and refuses a second book space", async () => {
    await db.update(spaces).set({ kind: "general" }).where(eq(spaces.id, "sp-books"));
    vi.mocked(lookupByTitle).mockResolvedValue(null);
    await seed("cv1", "https://www.goodreads.com/book/show/9.Foo");
    const r = await convertSpaceToBook("sp-books");
    expect(r).toEqual({ ok: true, pulled: 1 });
    expect((await db.select().from(spaces).where(eq(spaces.id, "sp-books")))[0].kind).toBe("book");
    expect((await blipOf("cv1")).spaceId).toBe("sp-books");
    expect(await convertSpaceToBook("sp-gen")).toMatchObject({ ok: false });
    expect(await convertSpaceToBook("sp-books")).toMatchObject({ ok: false });
  });
});

describe("updateBook", () => {
  const edit = {
    title: "Edited",
    authors: ["A One", "B Two"],
    coverUrl: "https://example.com/c.jpg",
    url: null,
    publisher: "Pub",
    publishedYear: 2001,
    pageCount: null,
    isbn13: null,
  };
  it("saves edits to the blip and details, replacing a failed status", async () => {
    await seed("edit-1", "https://example.com/x");
    await db.insert(bookDetails).values({ blipId: "edit-1", authors: "[]", lookupStatus: "failed", fetchedAt: now });
    expect((await updateBook("edit-1", edit)).ok).toBe(true);
    const b = await blipOf("edit-1");
    expect(b).toMatchObject({ title: "Edited", imageUrl: "https://example.com/c.jpg", url: null });
    expect(await detailsOf("edit-1")).toMatchObject({ authors: '["A One","B Two"]', lookupStatus: "ok", publishedYear: 2001 });
  });
  it("creates details for a blip without any and rejects non-https links", async () => {
    await seed("edit-2", null);
    expect((await updateBook("edit-2", edit)).ok).toBe(true);
    expect(await detailsOf("edit-2")).toBeTruthy();
    expect((await updateBook("edit-2", { ...edit, coverUrl: "http://x.com/a.jpg" })).ok).toBe(false);
  });
});
