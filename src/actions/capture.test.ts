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
vi.mock("@/lib/ai/organize", () => ({
  organizeLinks: vi.fn(
    async (_c: unknown, items: { id: number; url: string }[]) =>
      new Map(
        items.map((i) => [
          i.id,
          i.url.includes("book")
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
import { blips, spaces } from "@/db/schema";
import { createSpace } from "./spaces";
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
});
