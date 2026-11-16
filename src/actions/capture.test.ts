import { describe, it, expect, vi, beforeAll } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/og", () => ({
  fetchLinkMetadata: vi.fn(async () => ({
    title: "Page",
    description: "d",
    imageUrl: null,
    siteName: null,
  })),
}));
vi.mock("@/actions/settings", () => ({
  getAiConfig: vi.fn(async () => ({ provider: "openai", model: "m" })),
}));
vi.mock("@/lib/ai/providers", () => ({
  getApiKey: () => "key",
  providerInfo: { openai: { envKey: "OPENAI_API_KEY" } },
}));
vi.mock("@/lib/book-lookup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/book-lookup")>()),
  lookupByIsbn: vi.fn(async () => ({
    title: "Atomic Habits",
    subtitle: null,
    authors: ["James Clear"],
    isbn13: "9780735211292",
    publisher: "Penguin",
    publishedYear: 2018,
    pageCount: 321,
    description: null,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    infoUrl: null,
  })),
  lookupByTitle: vi.fn(async () => null),
  confirmBook: vi.fn(async (t: string) =>
    t === "Real Novel"
      ? {
          title: "Real Novel",
          subtitle: null,
          authors: ["Ann Author"],
          isbn13: "9781250178602",
          publisher: "Macmillan",
          publishedYear: 2020,
          pageCount: 300,
          description: null,
          coverUrl: "https://covers.openlibrary.org/b/isbn/9781250178602-L.jpg",
          infoUrl: null,
        }
      : null
  ),
  searchBooks: vi.fn(async () => []),
}));
vi.mock("@/lib/repo-lookup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repo-lookup")>()),
  lookupRepo: vi.fn(async () => ({
    description: "A repo",
    stars: 3,
    language: "Rust",
    topics: [],
    license: null,
    homepage: null,
    pushedAt: null,
    archived: false,
  })),
}));
vi.mock("@/lib/ai/organize", () => ({
  organizeLinks: vi.fn(
    async (_c: unknown, items: { id: number; url: string }[]) =>
      new Map(
        items.map((i) => [
          i.id,
          i.url.includes("tripsrepo")
            ? { title: "Trip planner", summary: "s", group: null, space: "Trips", reason: "Travel tool", book: null }
            : i.url.includes("realnovel") || i.url.includes("ghostnovel")
            ? {
                title: "Novel page",
                summary: "s",
                group: null,
                space: null,
                reason: null,
                book: {
                  title: i.url.includes("realnovel") ? "Real Novel" : "Ghost Novel",
                  author: "Ann Author",
                },
              }
            : i.url.includes("book")
            ? {
                title: "A Book",
                summary: "s",
                group: null,
                space: "Books",
                reason: "It is a book page",
              }
            : i.url.includes("topic")
              ? {
                  title: "Travel tip",
                  summary: "s",
                  group: "Trips",
                  space: null,
                  reason: null,
                }
              : {
                  title: "Misc",
                  summary: "s",
                  group: null,
                  space: null,
                  reason: null,
                },
        ])
      )
  ),
}));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, bookDetails, spaces } from "@/db/schema";
import { createSpace } from "./spaces";
import { repoDetails } from "@/db/schema";
import { importMarkdown } from "./capture";
import {
  listRoutingEvents,
  routingTotals,
  createRoutingRule,
  deleteRoutingRule,
  listRoutingRules,
} from "./routing";
import { deleteSpace } from "./spaces";

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

describe("capture routing + audit log", () => {
  it("routes by rule, group and AI, and logs a reason for every decision", async () => {
    const books = await createSpace({
      name: "Books",
      description: "Things to read",
      autoIntake: true,
    });
    const trips = await createSpace({ name: "Trips", autoIntake: true });
    if (!books.ok || !trips.ok) throw new Error("setup failed");
    // "Trips" group is linked to the Trips space by name; make sure a group row exists for linking.
    const r = await importMarkdown(
      [
        "[Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)",
        "[Book](https://example.com/book)",
        "[Topic](https://example.com/topic)",
        "[Topic2](https://example.com/topic2)",
        "[Plain](https://example.com/plain)",
      ].join("\n")
    );
    expect(r.ok).toBe(true);

    const events = await listRoutingEvents("all");
    expect(events).toHaveLength(5);
    const by = (url: string) => events.find((e) => e.url === url)!;

    expect(by("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({
      routedBy: "rule",
      spaceName: "Videos",
      source: "capture",
    });
    expect(by("https://example.com/book")).toMatchObject({
      routedBy: "ai",
      spaceName: "Books",
      reason: "It is a book page",
    });
    // Same-named group auto-links to the Trips space.
    expect(by("https://example.com/topic")).toMatchObject({
      routedBy: "group",
      spaceName: "Trips",
    });
    expect(by("https://example.com/topic").reason).toContain("Trips");
    expect(by("https://example.com/plain")).toMatchObject({
      routedBy: null,
      spaceId: null,
    });
    expect(by("https://example.com/plain").reason).toMatch(/left in the feed/);

    expect(await routingTotals()).toEqual({
      rule: 1,
      group: 2,
      ai: 1,
      inbox: 1,
    });
    expect((await listRoutingEvents("ai")).map((e) => e.spaceName)).toEqual([
      "Books",
    ]);
    expect(await listRoutingEvents("inbox")).toHaveLength(1);

    const [book] = await db
      .select()
      .from(blips)
      .where(eq(blips.url, "https://example.com/book"));
    expect(book.routedBy).toBe("ai");
    expect(book.routedReason).toBe("It is a book page");
  });

  it("does not offer a space to the AI once its AI routing is off", async () => {
    const { organizeLinks } = await import("@/lib/ai/organize");
    await db
      .update(spaces)
      .set({ aiRouting: false })
      .where(eq(spaces.name, "Books"));
    await importMarkdown("[Book 2](https://example.com/book2)");
    const call = vi.mocked(organizeLinks).mock.calls.at(-1)!;
    expect((call[3] as { name: string }[]).map((s) => s.name)).toEqual([
      "Trips",
    ]);
    // The mock still returned "Books"; it is not eligible, so the blip stays in the feed.
    const [b] = await db
      .select()
      .from(blips)
      .where(eq(blips.url, "https://example.com/book2"));
    expect(b.spaceId).toBeNull();
  });

  it("routes by a domain rule ahead of the AI, and deleting the space drops the rule", async () => {
    const dev = await createSpace({ name: "Dev Tools", autoIntake: true });
    if (!dev.ok) throw new Error("setup failed");
    expect(
      await createRoutingRule({ pattern: "nope", spaceId: dev.id })
    ).toMatchObject({ ok: false });
    const made = await createRoutingRule({
      pattern: "https://www.Docs.example.com/",
      spaceId: dev.id,
    });
    expect(made).toEqual({ ok: true, pattern: "docs.example.com" });
    expect(
      await createRoutingRule({ pattern: "docs.example.com", spaceId: dev.id })
    ).toMatchObject({ ok: false });

    // The mock AI would send ".../book" to Books; the rule must win.
    await importMarkdown("[Guide](https://docs.example.com/book)");
    const [ev] = (await listRoutingEvents("rule")).filter(
      (e) => e.url === "https://docs.example.com/book"
    );
    expect(ev).toMatchObject({ spaceName: "Dev Tools", routedBy: "rule" });
    expect(ev.reason).toBe("Domain rule: docs.example.com");

    expect(await listRoutingRules()).toHaveLength(1);
    await deleteSpace(dev.id);
    expect(await listRoutingRules()).toHaveLength(0);
    const rule = await createRoutingRule({
      pattern: "x.example.com",
      spaceId: (
        (await createSpace({ name: "Tmp", autoIntake: false })) as {
          id: string;
        }
      ).id,
    });
    if (!rule.ok) throw new Error("rule failed");
    const [r] = await listRoutingRules();
    await deleteRoutingRule(r.id);
    expect(await listRoutingRules()).toHaveLength(0);
  });

  it("routes a book link to the book space and fetches its details", async () => {
    const r = await importMarkdown("[Atomic](https://www.amazon.com/dp/0735211299)");
    expect(r.ok).toBe(true);
    const [ev] = (await listRoutingEvents("rule")).filter((e) => e.url === "https://www.amazon.com/dp/0735211299");
    expect(ev).toMatchObject({ routedBy: "rule", reason: "Book link" });
    expect(ev.spaceName).toBeTruthy();
    const [b] = await db.select().from(blips).where(eq(blips.url, "https://www.amazon.com/dp/0735211299"));
    expect(b).toMatchObject({
      title: "Atomic Habits",
      imageUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    });
    const [d] = await db.select().from(bookDetails).where(eq(bookDetails.blipId, b.id));
    expect(d).toMatchObject({ lookupStatus: "ok", isbn13: "9780735211292" });
  });

  it("places an AI-named book only after the book database confirms it", async () => {
    const r = await importMarkdown(
      "[a](https://store.example.com/realnovel)\n[b](https://store.example.com/ghostnovel)"
    );
    expect(r.ok).toBe(true);
    const real = (await db.select().from(blips).where(eq(blips.url, "https://store.example.com/realnovel")))[0];
    const ghost = (await db.select().from(blips).where(eq(blips.url, "https://store.example.com/ghostnovel")))[0];
    const [bookSpace] = await db.select().from(spaces).where(eq(spaces.kind, "book"));
    expect(real.spaceId).toBe(bookSpace.id);
    expect(real.routedReason).toMatch(/confirmed/);
    expect(real.title).toBe("Real Novel");
    expect((await db.select().from(bookDetails).where(eq(bookDetails.blipId, real.id)))[0]).toMatchObject({
      isbn13: "9781250178602",
    });
    expect(ghost.spaceId).toBeNull();
  });

  it("an AI guess at the book space without a named book stays in the feed", async () => {
    await importMarkdown("[x](https://example.org/just-a-book-review)");
    const [b] = await db.select().from(blips).where(eq(blips.url, "https://example.org/just-a-book-review"));
    expect(b.spaceId).toBeNull();
  });

  it("a repo link falls back to the code space, but a matching topic space wins", async () => {
    await importMarkdown(
      "[a](https://github.com/o/plainrepo)\n[b](https://github.com/o/tripsrepo)\n[c](https://github.com/o/plainrepo/blob/main/x.md)"
    );
    const get = async (u: string) => (await db.select().from(blips).where(eq(blips.url, u)))[0];
    const [codeSpace] = await db.select().from(spaces).where(eq(spaces.kind, "code"));
    const [trips] = await db.select().from(spaces).where(eq(spaces.name, "Trips"));
    const plain = await get("https://github.com/o/plainrepo");
    expect(plain).toMatchObject({ spaceId: codeSpace.id, routedBy: "rule", routedReason: "Code repository link" });
    expect((await get("https://github.com/o/tripsrepo")).spaceId).toBe(trips.id);
    expect((await get("https://github.com/o/plainrepo/blob/main/x.md")).spaceId).toBeNull();
    const [d] = await db.select().from(repoDetails).where(eq(repoDetails.blipId, plain.id));
    expect(d).toMatchObject({ owner: "o", name: "plainrepo", stars: 3, lookupStatus: "ok" });
  });
});
