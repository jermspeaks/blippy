import { describe, it, expect, vi, beforeAll } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const apiKey = vi.hoisted(() => ({ value: "key" as string | null }));
vi.mock("@/actions/settings", () => ({
  getAiConfig: vi.fn(async () => ({ provider: "openai", model: "m" })),
}));
vi.mock("@/lib/ai/providers", () => ({
  getApiKey: () => apiKey.value,
  providerInfo: { openai: { envKey: "OPENAI_API_KEY" } },
}));
vi.mock("@/lib/ai/organize", () => ({
  organizeLinks: vi.fn(
    async (_c: unknown, items: { id: number; url: string }[]) =>
      new Map(
        items.map((i) => [
          i.id,
          {
            title: "",
            summary: "",
            group: null,
            space: i.url.includes("book") ? "Books" : null,
            reason: i.url.includes("book") ? "It is a book" : null,
          },
        ])
      )
  ),
}));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, blipGroups, routingRules } from "@/db/schema";
import { createSpace } from "./spaces";
import { countRerouteCandidates, rerouteFeedBlips } from "./reroute";
import { listRoutingEvents } from "./routing";

const now = new Date();
const day = 24 * 3600 * 1000;
let n = 0;
async function seed(
  id: string,
  o: {
    url?: string | null;
    groupId?: string | null;
    next?: Date | null;
    spaceId?: string | null;
    status?: "active" | "fizzled";
  } = {}
) {
  await db.insert(blips).values({
    id,
    content: id,
    title: id,
    url: o.url ?? null,
    groupId: o.groupId ?? null,
    spaceId: o.spaceId ?? null,
    nextReviewAt: o.next ?? null,
    status: o.status ?? "active",
    createdAt: new Date(now.getTime() + n++),
    updatedAt: now,
  });
}
const spaceOf = async (id: string) =>
  (await db.select().from(blips).where(eq(blips.id, id)))[0].spaceId;

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

describe("rerouteFeedBlips", () => {
  it("routes due feed blips by rule, group, video and AI; logs only moves", async () => {
    const books = await createSpace({
      name: "Books",
      description: "Things to read",
      autoIntake: true,
    });
    const dev = await createSpace({ name: "Dev Tools", autoIntake: true });
    const trips = await createSpace({ name: "Trip Plans", autoIntake: true });
    if (!books.ok || !dev.ok || !trips.ok) throw new Error("setup failed");

    await db
      .insert(routingRules)
      .values({
        id: "r1",
        pattern: "github.com",
        spaceId: dev.id,
        createdAt: now,
      });
    await db
      .insert(blipGroups)
      .values({ id: "g1", label: "Travel", spaceId: trips.id, createdAt: now });

    await seed("rule", { url: "https://github.com/x/y" });
    await seed("group", { url: "https://example.com/a", groupId: "g1" });
    await seed("video", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    await seed("ai", { url: "https://example.com/book" });
    await seed("miss", { url: "https://example.com/plain" });
    // Not eligible:
    await seed("snoozed", {
      url: "https://github.com/snoozed",
      next: new Date(now.getTime() + 3 * day),
    });
    await seed("stored", {
      url: "https://github.com/stored",
      spaceId: books.id,
    });
    await seed("fizzled", {
      url: "https://github.com/fizzled",
      status: "fizzled",
    });

    expect(await countRerouteCandidates()).toBe(5);
    const r = await rerouteFeedBlips();
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({
      checked: 5,
      moved: 4,
      byRule: 2,
      byGroup: 1,
      byAi: 1,
      remaining: 0,
      usedAi: true,
    });

    expect(await spaceOf("rule")).toBe(dev.id);
    expect(await spaceOf("group")).toBe(trips.id);
    expect(await spaceOf("ai")).toBe(books.id);
    expect(await spaceOf("miss")).toBeNull();
    expect(await spaceOf("snoozed")).toBeNull();
    expect(await spaceOf("stored")).toBe(books.id);
    expect(await spaceOf("fizzled")).toBeNull();

    const [aiBlip] = await db.select().from(blips).where(eq(blips.id, "ai"));
    expect(aiBlip).toMatchObject({
      routedBy: "ai",
      routedReason: "It is a book",
    });

    // Only moved blips are logged, with source "reroute".
    const events = await listRoutingEvents("all");
    expect(events).toHaveLength(4);
    expect(events.every((e) => e.source === "reroute" && e.spaceId)).toBe(true);
    // Titles/summary untouched.
    expect(aiBlip.title).toBe("ai");
  });

  it("skips the AI step with a warning when there is no key, still applying rules", async () => {
    apiKey.value = null;
    await seed("rule2", { url: "https://github.com/another" });
    await seed("ai2", { url: "https://example.com/book2" });
    const r = await rerouteFeedBlips();
    if (!r.ok) throw new Error(r.error);
    expect(r.usedAi).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/OPENAI_API_KEY/);
    expect(r.byRule).toBe(1);
    expect(await spaceOf("ai2")).toBeNull();
    apiKey.value = "key";
  });

  it("reports when nothing is left to re-route", async () => {
    await db.update(blips).set({ status: "fizzled" });
    const r = await rerouteFeedBlips();
    expect(r.ok).toBe(false);
  });
});
