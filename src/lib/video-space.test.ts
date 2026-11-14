import { describe, it, expect, vi, beforeAll } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, spaces } from "@/db/schema";
import { ensureVideoSpace, sweepVideoBlips } from "./video-space";
import { createSpace } from "@/actions/spaces";

const now = new Date();
const seed = (id: string, url: string | null) =>
  db.insert(blips).values({ id, content: id, url, status: "active", createdAt: now, updatedAt: now });
const spaceOf = async (id: string) =>
  (await db.select().from(blips).where(eq(blips.id, id)))[0].spaceId;

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));

describe("video space", () => {
  it("creates a video space once and reuses it", () => {
    const a = ensureVideoSpace(db);
    const b = ensureVideoSpace(db);
    expect(a?.kind).toBe("video");
    expect(b?.id).toBe(a?.id);
  });

  it("returns null when the video space has auto-intake off", async () => {
    const s = ensureVideoSpace(db)!;
    await db.update(spaces).set({ autoIntake: false }).where(eq(spaces.id, s.id));
    expect(ensureVideoSpace(db)).toBeNull();
    await db.update(spaces).set({ autoIntake: true }).where(eq(spaces.id, s.id));
  });

  it("sweeps only real video links", async () => {
    await seed("v1", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await seed("v2", "https://youtu.be/dQw4w9WgXcQ");
    await seed("c1", "https://www.youtube.com/@somechannel");
    await seed("n1", null);
    const s = ensureVideoSpace(db)!;
    expect(sweepVideoBlips(db, s.id)).toBe(2);
    expect(await spaceOf("v1")).toBe(s.id);
    expect(await spaceOf("c1")).toBeNull();
    expect(await spaceOf("n1")).toBeNull();
  });

  it("creating a video-kind space pulls in existing videos", async () => {
    await db.update(blips).set({ spaceId: null });
    await db.delete(spaces);
    const r = await createSpace({ name: "Watch later", autoIntake: true, kind: "video" });
    expect(r.ok && r.pulled).toBe(2);
    expect(ensureVideoSpace(db)?.name).toBe("Watch later");
  });
});
