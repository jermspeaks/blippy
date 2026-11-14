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
import {
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
