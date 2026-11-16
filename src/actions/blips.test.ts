import { describe, it, expect, vi, beforeAll } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/db";
import { blips } from "@/db/schema";
import { getFeedCap, saveFeedCap } from "./settings";
import { addDays, addMonths } from "@/lib/snooze";
import {
  countDueBlips,
  getFeedBlips,
  listSnoozedBlips,
  snoozeBlip,
  unsnoozeBlip,
} from "./blips";

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

function blip(id: string) {
  const now = new Date();
  return {
    id,
    content: id,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
}

describe("snoozed blips", () => {
  it("lists snoozed blips and unsnoozing returns them to the feed", async () => {
    await db.insert(blips).values([blip("a"), blip("b")]);
    const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
    await snoozeBlip("a", tomorrow);

    expect((await listSnoozedBlips()).map((b) => b.id)).toEqual(["a"]);
    expect((await getFeedBlips()).map((b) => b.id)).toEqual(["b"]);

    await unsnoozeBlip("a");
    expect(await listSnoozedBlips()).toHaveLength(0);
    expect((await getFeedBlips()).map((b) => b.id).sort()).toEqual(["a", "b"]);
  });
});

describe("snooze dates", () => {
  it("rejects today and the past, accepts a preset-style day", async () => {
    await db.insert(blips).values(blip("s1"));
    expect(await snoozeBlip("s1", new Date())).toMatchObject({ ok: false });
    expect(await snoozeBlip("s1", addDays(new Date(), -3))).toMatchObject({ ok: false });
    expect(await snoozeBlip("s1", addDays(new Date(), 7))).toEqual({ ok: true });
    expect(await snoozeBlip("s1", addMonths(new Date(), 1))).toEqual({ ok: true });
    await unsnoozeBlip("s1");
  });
});

describe("feed size limit", () => {
  it("defaults to 50, validates, and limits the feed while still counting everything due", async () => {
    expect(await getFeedCap()).toBe(50);
    await db.insert(blips).values(Array.from({ length: 8 }, (_, i) => blip(`cap-${i}`)));
    const due = await countDueBlips();
    expect(due).toBeGreaterThanOrEqual(8);

    expect(await saveFeedCap(2)).toMatchObject({ ok: false });
    expect(await saveFeedCap(500)).toMatchObject({ ok: false });
    expect(await saveFeedCap(1.5)).toMatchObject({ ok: false });
    expect(await getFeedCap()).toBe(50);

    expect(await saveFeedCap(5)).toEqual({ ok: true });
    expect(await getFeedCap()).toBe(5);
    expect(await getFeedBlips()).toHaveLength(5);
    expect(await countDueBlips()).toBe(due);

    expect(await saveFeedCap(200)).toEqual({ ok: true });
    expect((await getFeedBlips()).length).toBe(due);
  });
});
