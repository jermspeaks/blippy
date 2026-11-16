import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { blips, spaces, type Space } from "@/db/schema";
import type { Db } from "@/db";
import { isRepoUrl } from "@/lib/repo";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

/** General spaces with these names (case-insensitive) are adopted instead of creating a duplicate. */
const ADOPTABLE = ["programming projects", "code", "github", "repos", "repositories"];

/**
 * The space that repository links fall back to: the first space of kind "code".
 * If none exists, a general space named like "Programming Projects" is converted
 * (never leave a duplicate next to it); otherwise "Code" is created. Returns
 * null if the code space has auto-intake turned off.
 */
export function ensureCodeSpace(conn: Conn): Space | null {
  const existing = conn.select().from(spaces).where(eq(spaces.kind, "code")).all()[0];
  if (existing) return existing.autoIntake ? existing : null;

  const named = conn
    .select()
    .from(spaces)
    .where(
      and(
        eq(spaces.kind, "general"),
        inArray(sql`lower(${spaces.name})`, ADOPTABLE)
      )
    )
    .all()
    .sort((a, b) => ADOPTABLE.indexOf(a.name.toLowerCase()) - ADOPTABLE.indexOf(b.name.toLowerCase()))[0];
  if (named) {
    conn.update(spaces).set({ kind: "code" }).where(eq(spaces.id, named.id)).run();
    const converted: Space = { ...named, kind: "code" };
    return converted.autoIntake ? converted : null;
  }

  const taken = new Set(
    conn.select({ name: spaces.name }).from(spaces).all().map((s) => s.name.toLowerCase())
  );
  const space: Space = {
    id: randomUUID(),
    name: taken.has("code") ? `Code ${randomUUID().slice(0, 4)}` : "Code",
    description: "Code repositories from links you've captured",
    kind: "code",
    autoIntake: true,
    aiRouting: true,
    createdAt: new Date(),
  };
  conn.insert(spaces).values(space).run();
  return space;
}

/** Move unstored, active blips with a repository link into the given code space. */
export function sweepRepoBlips(conn: Conn, spaceId: string): number {
  const ids = conn
    .select({ id: blips.id, url: blips.url })
    .from(blips)
    .where(and(isNull(blips.spaceId), eq(blips.status, "active"), isNotNull(blips.url)))
    .all()
    .filter((b) => isRepoUrl(b.url))
    .map((b) => b.id);
  if (ids.length === 0) return 0;
  return conn
    .update(blips)
    .set({ spaceId, updatedAt: new Date() })
    .where(inArray(blips.id, ids))
    .run().changes;
}
