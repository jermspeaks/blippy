import { describe, it, expect, vi } from "vitest";
import {
  cleanPageTitle,
  titleSimilarity,
  lookupByIsbn,
  lookupByTitle,
  searchBooks,
  hasBookEvidence,
  confirmBook,
  LookupUnavailableError,
} from "./book-lookup";

const google = (items: unknown[]) =>
  new Response(JSON.stringify({ items }), { status: 200 });
const vol = (title: string, extra: Record<string, unknown> = {}) => ({
  volumeInfo: {
    title,
    authors: ["James Clear"],
    industryIdentifiers: [{ type: "ISBN_13", identifier: "9780735211292" }],
    imageLinks: { thumbnail: "http://books.google.com/x?id=1&edge=curl&zoom=1" },
    publishedDate: "2018-10-16",
    pageCount: 321,
    ...extra,
  },
});

/** fetch stub: routes by URL host. */
function stub(routes: { google?: () => Response; ol?: () => Response; cover?: number }) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("googleapis.com")) return routes.google?.() ?? new Response("{}", { status: 500 });
    if (u.includes("covers.openlibrary.org")) return new Response(null, { status: routes.cover ?? 404 });
    if (u.includes("openlibrary.org/search")) return routes.ol?.() ?? new Response("{}", { status: 500 });
    throw new Error(`unexpected ${u}`);
  }) as unknown as typeof fetch;
}

describe("titles", () => {
  it("cleans site suffixes and 'by author'", () => {
    expect(cleanPageTitle("Atomic Habits | Penguin Random House")).toBe("Atomic Habits");
    expect(cleanPageTitle("The Remarried Empress (novel)")).toBe("The Remarried Empress");
    expect(cleanPageTitle("The Thinking Machine by Stephen Witt")).toBe("The Thinking Machine");
  });
  it("scores same book high and unrelated pages low", () => {
    const book = { title: "Slack", subtitle: "Getting Past Burnout, Busywork, and the Myth of Total Efficiency" };
    expect(titleSimilarity("Slack: Getting Past Burnout, Busywork, and Total Efficiency", book)).toBeGreaterThan(0.6);
    expect(titleSimilarity("Slack – Where work happens", book)).toBeLessThan(0.6);
    expect(titleSimilarity("ESP8266 Internet of Things Cookbook pdf", { title: "Atomic Habits", subtitle: null })).toBe(0);
  });
});

describe("book evidence", () => {
  const sc = { authors: ["Cathy Agin", "Marjorie Curiel"] };
  it("needs an author surname or a book label on the page", () => {
    const page = { title: "Story Club", summary: "George Saunders on writing", url: "https://x.com/story-club" };
    expect(hasBookEvidence(sc, page)).toBe(false);
    expect(hasBookEvidence({ authors: ["George Saunders"] }, page)).toBe(true);
    expect(hasBookEvidence(sc, { ...page, url: "https://en.wikipedia.org/wiki/Foo_(novel)" })).toBe(true);
    expect(hasBookEvidence(sc, { ...page, url: "https://rachelegross.com/book?x=1" })).toBe(true);
    expect(hasBookEvidence({ authors: ["Li"] }, { ...page, summary: "li li li" })).toBe(false); // surname too short
  });
  it("lookupByTitle skips candidates the page gives no evidence for", async () => {
    const f = stub({ google: () => google([vol("Story Club", { authors: ["Cathy Agin"] }), vol("Story Club", { authors: ["George Saunders"] })]) });
    const page = { title: "Story Club", summary: "by George Saunders", url: null };
    const b = await lookupByTitle("Story Club", { fetch: f, googleKey: "k" }, (x) => hasBookEvidence(x, page));
    expect(b?.authors).toEqual(["George Saunders"]);
  });
});

describe("lookups", () => {
  it("looks up by ISBN and prefers the Open Library cover when it exists", async () => {
    const f = stub({ google: () => google([vol("Atomic Habits")]), cover: 200 });
    const b = await lookupByIsbn("9780735211292", { fetch: f, googleKey: "k" });
    expect(b).toMatchObject({
      title: "Atomic Habits",
      authors: ["James Clear"],
      isbn13: "9780735211292",
      publishedYear: 2018,
      pageCount: 321,
      coverUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    });
  });

  it("falls back to the Google cover (https, no curl) when Open Library has none", async () => {
    const f = stub({ google: () => google([vol("Atomic Habits")]), cover: 404 });
    const b = await lookupByIsbn("9780735211292", { fetch: f, googleKey: "k" });
    expect(b?.coverUrl).toBe("https://books.google.com/x?id=1&zoom=1");
  });

  it("uses Open Library when there is no key or Google errors", async () => {
    const ol = () =>
      new Response(
        JSON.stringify({
          docs: [{ title: "Atomic Habits", author_name: ["James Clear"], isbn: ["0735211299"], cover_i: 7 }],
        }),
        { status: 200 }
      );
    const noKey = await lookupByIsbn("9780735211292", { fetch: stub({ ol }), googleKey: null });
    expect(noKey).toMatchObject({ title: "Atomic Habits", coverUrl: "https://covers.openlibrary.org/b/id/7-L.jpg" });
    const googleDown = await lookupByIsbn("9780735211292", {
      fetch: stub({ google: () => new Response("{}", { status: 429 }), ol }),
      googleKey: "k",
    });
    expect(googleDown?.title).toBe("Atomic Habits");
  });

  it("throws (retry later) when every source errors, returns null on a clean miss", async () => {
    const f = stub({});
    await expect(lookupByIsbn("9780735211292", { fetch: f, googleKey: "k" })).rejects.toBeInstanceOf(
      LookupUnavailableError
    );
    const clean = stub({
      google: () => google([]),
      ol: () => new Response(JSON.stringify({ docs: [] })),
    });
    expect(await lookupByIsbn("9780735211292", { fetch: clean, googleKey: "k" })).toBeNull();
  });

  it("confirms an AI-named book by title and author surname", async () => {
    const f = stub({ google: () => google([vol("Atomic Habits")]) });
    const deps = { fetch: f, googleKey: "k" };
    expect((await confirmBook("Atomic Habits", "James Clear", deps))?.title).toBe("Atomic Habits");
    expect(await confirmBook("Atomic Habits", "Someone Else", deps)).toBeNull();
    expect(await confirmBook("Totally Unrelated Title", "James Clear", deps)).toBeNull();
  });

  it("title lookup only accepts a similar-enough match", async () => {
    const f = stub({ google: () => google([vol("Totally Different Book"), vol("The Thinking Machine")]) });
    expect((await lookupByTitle("The Thinking Machine | Penguin", { fetch: f, googleKey: "k" }))?.title).toBe(
      "The Thinking Machine"
    );
    const none = stub({ google: () => google([vol("Totally Different Book")]) });
    expect(await lookupByTitle("ESP8266 Cookbook.pdf at master", { fetch: none, googleKey: "k" })).toBeNull();
  });

  it("searchBooks treats an ISBN as an exact query", async () => {
    const f = stub({ google: () => google([vol("Atomic Habits")]) });
    await searchBooks("0735211299", { fetch: f, googleKey: "k" });
    const called = (f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(decodeURIComponent(called)).toContain("q=isbn:9780735211292");
    expect(called).not.toContain("key=undefined");
  });
});
