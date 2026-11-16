import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { blips, bookDetails, spaces, type Blip } from "@/db/schema";
import { parseBookUrl } from "@/lib/book";
import { hasBookEvidence, lookupByIsbn, lookupByTitle, type BookInfo } from "@/lib/book-lookup";

const CONCURRENCY = 2;

/** `deferred`: the lookup service was unavailable (rate limit, network); nothing was recorded, so it is retried later. */
export type HydrateCounts = { ok: number; partial: number; failed: number; deferred: number };

/** Active link blips in a book space that have no details row yet (never looked up). */
export function pendingBookBlips(limit: number, spaceId?: string): Blip[] {
  return db
    .select({ blip: blips })
    .from(blips)
    .innerJoin(spaces, eq(blips.spaceId, spaces.id))
    .leftJoin(bookDetails, eq(bookDetails.blipId, blips.id))
    .where(
      and(
        eq(spaces.kind, "book"),
        eq(blips.status, "active"),
        isNotNull(blips.url),
        isNull(bookDetails.blipId),
        spaceId ? eq(blips.spaceId, spaceId) : undefined
      )
    )
    .orderBy(asc(blips.createdAt))
    .limit(limit)
    .all()
    .map((r) => r.blip);
}

async function findBook(blip: Blip): Promise<{ info: BookInfo; exact: boolean } | null> {
  const ref = parseBookUrl(blip.url);
  if (ref?.isbn13) {
    // The ISBN already qualifies the blip; one lookup for the details, no title guessing after it.
    const info = await lookupByIsbn(ref.isbn13);
    return info ? { info, exact: true } : null;
  }
  const title = blip.title ?? "";
  if (title) {
    // Book sites are trusted on title alone; any other page must show it is about that book.
    const page = { title, summary: blip.summary, url: blip.url };
    const info = await lookupByTitle(
      title,
      {},
      ref ? undefined : (b) => hasBookEvidence(b, page)
    );
    if (info) return { info, exact: false };
  }
  return null;
}

/** A book the URL itself identifies: keep its ISBN as a good match even if the API has nothing. */
function saveUrlIsbn(blip: Pick<Blip, "id">, isbn13: string) {
  db.insert(bookDetails)
    .values({ blipId: blip.id, isbn13, authors: "[]", lookupStatus: "ok", fetchedAt: new Date() })
    .onConflictDoNothing()
    .run();
}

export function save(blip: Pick<Blip, "id" | "url" | "imageUrl" | "summary">, found: { info: BookInfo; exact: boolean } | null) {
  const now = new Date();
  const urlIsbn = parseBookUrl(blip.url)?.isbn13;
  if (!found && urlIsbn) {
    saveUrlIsbn(blip, urlIsbn);
    // Stored as a good match, but counted as "no details found" for the caller.
    return "failed" as const;
  }
  if (!found) {
    // Keep any earlier good details; only record a failure when there are none.
    db.insert(bookDetails)
      .values({ blipId: blip.id, lookupStatus: "failed", fetchedAt: now })
      .onConflictDoNothing()
      .run();
    return "failed" as const;
  }
  const { info, exact } = found;
  const details = {
    isbn13: info.isbn13,
    authors: JSON.stringify(info.authors),
    publisher: info.publisher,
    publishedYear: info.publishedYear,
    pageCount: info.pageCount,
    lookupStatus: exact ? ("ok" as const) : ("partial" as const),
    fetchedAt: now,
  };
  db.transaction((tx) => {
    tx.update(blips)
      .set({
        title: info.title,
        content: blip.url ? `[${info.title}](${blip.url})` : info.title,
        imageUrl: info.coverUrl ?? blip.imageUrl,
        summary: blip.summary ?? info.description?.slice(0, 500) ?? null,
        updatedAt: now,
      })
      .where(eq(blips.id, blip.id))
      .run();
    tx.insert(bookDetails)
      .values({ blipId: blip.id, ...details })
      .onConflictDoUpdate({ target: bookDetails.blipId, set: details })
      .run();
  });
  return details.lookupStatus;
}

/**
 * Look up and store book details for these blips. Never throws: a failed lookup
 * is recorded and the blip is left as captured. Title-only matches must be
 * similar to the saved title, so non-book pages are not rewritten.
 */
export async function hydrateBooks(targets: Blip[]): Promise<HydrateCounts> {
  const counts: HydrateCounts = { ok: 0, partial: 0, failed: 0, deferred: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (next < targets.length) {
        const blip = targets[next++];
        let found: Awaited<ReturnType<typeof findBook>> = null;
        try {
          found = await findBook(blip);
        } catch (err) {
          // Unavailable (e.g. rate limited): record nothing so a later run retries.
          console.error("Book lookup failed", err instanceof Error ? err.message : err);
          counts.deferred++;
          continue;
        }
        counts[save(blip, found)]++;
      }
    })
  );
  return counts;
}

/** Hydrate up to `limit` blips in book spaces that were never looked up. */
export async function hydratePendingBooks(limit = 25, spaceId?: string): Promise<HydrateCounts> {
  return hydrateBooks(pendingBookBlips(limit, spaceId));
}
