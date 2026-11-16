import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { blips, spaces, type Space } from "@/db/schema";
import type { Db } from "@/db";
import { isBookUrl } from "@/lib/book";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

/**
 * The space that book links route to: the first space of kind "book". If none
 * exists, an existing general space named "Books" is converted (never leave a
 * duplicate next to it); otherwise one is created. Returns null if the book
 * space has auto-intake turned off.
 */
export function ensureBookSpace(conn: Conn): Space | null {
  const existing = conn.select().from(spaces).where(eq(spaces.kind, "book")).all()[0];
  if (existing) return existing.autoIntake ? existing : null;

  const named = conn
    .select()
    .from(spaces)
    .where(and(eq(spaces.kind, "general"), sql`lower(${spaces.name}) = 'books'`))
    .all()[0];
  if (named) {
    conn.update(spaces).set({ kind: "book" }).where(eq(spaces.id, named.id)).run();
    const converted: Space = { ...named, kind: "book" };
    return converted.autoIntake ? converted : null;
  }

  const taken = new Set(
    conn.select({ name: spaces.name }).from(spaces).all().map((s) => s.name.toLowerCase())
  );
  const space: Space = {
    id: randomUUID(),
    name: taken.has("books") ? `Books ${randomUUID().slice(0, 4)}` : "Books",
    description: "Books from links you've captured",
    kind: "book",
    autoIntake: true,
    aiRouting: true,
    createdAt: new Date(),
  };
  conn.insert(spaces).values(space).run();
  return space;
}

/** Move unstored, active blips with a book link into the given book space. */
export function sweepBookBlips(conn: Conn, spaceId: string): number {
  const ids = conn
    .select({ id: blips.id, url: blips.url })
    .from(blips)
    .where(and(isNull(blips.spaceId), eq(blips.status, "active"), isNotNull(blips.url)))
    .all()
    .filter((b) => isBookUrl(b.url))
    .map((b) => b.id);
  if (ids.length === 0) return 0;
  return conn
    .update(blips)
    .set({ spaceId, updatedAt: new Date() })
    .where(inArray(blips.id, ids))
    .run().changes;
}
