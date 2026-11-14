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
  listSpacesWithCounts,
  routeGroupToSpace,
  createSpaceFromGroup,
} from "./spaces";
import { getFeedBlips } from "./blips";

const now = new Date();
async function seedGroup(id: string, label: string) {
  await db.insert(blipGroups).values({ id, label, createdAt: now });
}
async function seedBlip(id: string, groupId: string | null) {
  await db.insert(blips).values({
    id,
    content: id,
    title: id,
    groupId,
    status: "active",
    createdAt: now,
    updatedAt: now,
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

  it("creates a space from a group: moves blips, drops the label, keeps the link", async () => {
    await seedGroup("g-t", "Travel Ideas");
    await seedBlip("t1", "g-t");
    await seedBlip("t2", "g-t");
    const r = await createSpaceFromGroup("g-t", {
      name: "Travel",
      description: "Trips to plan",
    });
    if (!r.ok) throw new Error("failed");
    expect(r.moved).toBe(2);
    expect(await spaceOf("t1")).toBe(r.id);
    const [b] = await db.select().from(blips).where(eq(blips.id, "t1"));
    expect(b.groupId).toBeNull();
    const [g] = await db
      .select()
      .from(blipGroups)
      .where(eq(blipGroups.id, "g-t"));
    expect(g.spaceId).toBe(r.id);
    expect((await createSpaceFromGroup("g-t", { name: "travel" })).ok).toBe(
      false
    );
  });

  it("moves a group to an existing space even with auto-intake off", async () => {
    const s = await createSpace({ name: "Archive", autoIntake: false });
    if (!s.ok) throw new Error("create failed");
    await seedGroup("g-a", "Old Stuff");
    await seedBlip("a1", "g-a");
    const r = await routeGroupToSpace("g-a", s.id);
    expect(r.ok && r.moved).toBe(1);
    expect(await spaceOf("a1")).toBe(s.id);
  });

  it("suggests linking the group when a blip is stored by hand", async () => {
    const s = await createSpace({ name: "Reading", autoIntake: true });
    if (!s.ok) throw new Error("create failed");
    await seedGroup("g-rd", "Long Reads");
    await seedBlip("rd1", "g-rd");
    await seedBlip("rd2", "g-rd");
    const r = await storeBlip("rd1", s.id);
    expect(r.ok && r.suggestGroup).toEqual({
      id: "g-rd",
      label: "Long Reads",
      others: 1,
    });
    await routeGroupToSpace("g-rd", s.id);
    await seedBlip("rd3", "g-rd");
    const again = await storeBlip("rd3", s.id);
    expect(again.ok && again.suggestGroup).toBeNull();
  });

  it("persists the AI-routing switch and leaves it alone when omitted", async () => {
    const s = await createSpace({ name: "Switchy", autoIntake: true });
    if (!s.ok) throw new Error("create failed");
    const get = async () => (await getSpaceDetail(s.id))!.space.aiRouting;
    expect(await get()).toBe(true);
    await updateSpace(s.id, {
      name: "Switchy",
      autoIntake: true,
      aiRouting: false,
    });
    expect(await get()).toBe(false);
    await updateSpace(s.id, { name: "Switchy", autoIntake: true });
    expect(await get()).toBe(false);
  });

  it("hides fizzled blips from a space and its count", async () => {
    const s = await createSpace({ name: "Fizzy", autoIntake: true });
    if (!s.ok) throw new Error("create failed");
    await seedBlip("f1", null);
    await seedBlip("f2", null);
    await storeBlip("f1", s.id);
    await storeBlip("f2", s.id);
    await db.update(blips).set({ status: "fizzled" }).where(eq(blips.id, "f2"));
    expect((await getSpaceDetail(s.id))!.blips.map((b) => b.id)).toEqual([
      "f1",
    ]);
    const row = (await listSpacesWithCounts()).find((x) => x.id === s.id);
    expect(row?.blipCount).toBe(1);
    expect(Math.floor(row!.lastAddedAt!.getTime() / 1000)).toBe(
      Math.floor(now.getTime() / 1000)
    );
  });
});
