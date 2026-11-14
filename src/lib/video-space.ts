import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { blips, spaces, type Space } from "@/db/schema";
import type { Db } from "@/db";
import { isVideoUrl } from "@/lib/video";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

/**
 * The space that video links route to: the first space of kind "video", created
 * on first use. Returns null if it exists but has auto-intake turned off.
 */
export function ensureVideoSpace(conn: Conn): Space | null {
  const existing = conn.select().from(spaces).where(eq(spaces.kind, "video")).all()[0];
  if (existing) return existing.autoIntake ? existing : null;

  const taken = new Set(
    conn.select({ name: spaces.name }).from(spaces).all().map((s) => s.name.toLowerCase())
  );
  const name = ["Videos", "Video space", "Video library"].find((n) => !taken.has(n.toLowerCase()));
  const space: Space = {
    id: randomUUID(),
    name: name ?? `Videos ${randomUUID().slice(0, 4)}`,
    description: "Videos from links you've captured",
    kind: "video",
    autoIntake: true,
    aiRouting: true,
    createdAt: new Date(),
  };
  conn.insert(spaces).values(space).run();
  return space;
}

/** Move unstored, active video blips into the given video space. */
export function sweepVideoBlips(conn: Conn, spaceId: string): number {
  const ids = conn
    .select({ id: blips.id, url: blips.url })
    .from(blips)
    .where(and(isNull(blips.spaceId), eq(blips.status, "active"), isNotNull(blips.url)))
    .all()
    .filter((b) => isVideoUrl(b.url))
    .map((b) => b.id);
  if (ids.length === 0) return 0;
  return conn
    .update(blips)
    .set({ spaceId, updatedAt: new Date() })
    .where(inArray(blips.id, ids))
    .run().changes;
}
