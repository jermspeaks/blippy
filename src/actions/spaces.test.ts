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
import { blips, blipGroups } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSpace,
  updateSpace,
  deleteSpace,
  linkGroupToSpace,
  unlinkGroupFromSpace,
  storeBlip,
  unstoreBlip,
  getSpaceDetail,
} from "./spaces";
import { getFeedBlips } from "./blips";

const now = new Date();
async function seedGroup(id: string, label: string) {
  await db.insert(blipGroups).values({ id, label, createdAt: now });
}
async function seedBlip(id: string, groupId: string | null) {
  await db.insert(blips).values({
    id, content: id, title: id, groupId, status: "active", createdAt: now, updatedAt: now,
  });
}
const spaceOf = async (id: string) =>
  (await db.select().from(blips).where(eq(blips.id, id)))[0].spaceId;

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

describe("spaces", () => {
  it("auto-links a same-named group and pulls in all its blips", async () => {
    await seedGroup("g-ob", "Obituaries");
    await seedBlip("b1", "g-ob");
    await seedBlip("b2", "g-ob");
    await seedBlip("b3", null);
    const r = await createSpace({ name: "obituaries", autoIntake: true });
    expect(r.ok && r.pulled).toBe(2);
    if (!r.ok) return;
    expect(await spaceOf("b1")).toBe(r.id);
    expect(await spaceOf("b3")).toBeNull();
    // stored blips leave the feed
    const feed = (await getFeedBlips()).map((b) => b.id);
    expect(feed).toContain("b3");
    expect(feed).not.toContain("b1");
  });

  it("rejects duplicate names", async () => {
    const r = await createSpace({ name: "OBITUARIES", autoIntake: true });
    expect(r.ok).toBe(false);
  });

  it("does not pull when auto-intake is off, until it is turned on", async () => {
    await seedGroup("g-r", "Recipes");
    await seedBlip("r1", "g-r");
    const s = await createSpace({ name: "Kitchen", autoIntake: false });
    if (!s.ok) throw new Error("create failed");
    const l = await linkGroupToSpace(s.id, "g-r");
    expect(l.ok && l.pulled).toBe(0);
    expect(await spaceOf("r1")).toBeNull();
    const u = await updateSpace(s.id, { name: "Kitchen", autoIntake: true });
    expect(u.ok && u.pulled).toBe(1);
    expect(await spaceOf("r1")).toBe(s.id);
  });

  it("stores manually, returns to feed, unlinks without evicting, deletes safely", async () => {
    const s = await createSpace({ name: "Misc", autoIntake: true });
    if (!s.ok) throw new Error("create failed");
    await seedBlip("m1", null);
    await storeBlip("m1", s.id);
    expect(await spaceOf("m1")).toBe(s.id);
    await unstoreBlip("m1", s.id);
    expect(await spaceOf("m1")).toBeNull();

    await storeBlip("m1", s.id);
    await seedGroup("g-m", "Misc Group");
    await linkGroupToSpace(s.id, "g-m");
    await unlinkGroupFromSpace(s.id, "g-m");
    expect(await spaceOf("m1")).toBe(s.id);

    const d = await getSpaceDetail(s.id);
    expect(d?.blips.map((b) => b.id)).toEqual(["m1"]);

    await deleteSpace(s.id);
    expect(await spaceOf("m1")).toBeNull();
    expect(await getSpaceDetail(s.id)).toBeNull();
  });
});
