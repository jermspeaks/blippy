import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spaces, type Space } from "@/db/schema";
import { parseVideoUrl } from "@/lib/video";
import { parseBookUrl } from "@/lib/book";
import { ensureVideoSpace } from "@/lib/video-space";
import { ensureBookSpace } from "@/lib/book-space";

/**
 * Specialized spaces that deterministic rules route into, ensured only when a
 * URL in the batch needs them (video and book spaces are created or adopted on
 * first use). Each is null when not needed or when its auto-intake is off.
 * `spaceById` includes any space created or converted here so callers can name it.
 */
export function resolveKindSpaces(
  urls: (string | null)[],
  allSpaces: Space[],
  opts: { forceBook?: boolean } = {}
): {
  videoSpaceId: string | null;
  bookSpaceId: string | null;
  spaceById: Map<string, Space>;
  /** Every book-kind space, so guessed routes can be kept out of them. */
  bookSpaceIds: Set<string>;
} {
  const spaceById = new Map(allSpaces.map((s) => [s.id, s]));
  const video = urls.some((u) => parseVideoUrl(u))
    ? db.transaction((tx) => ensureVideoSpace(tx))
    : null;
  const book = opts.forceBook || urls.some((u) => parseBookUrl(u))
    ? db.transaction((tx) => ensureBookSpace(tx))
    : null;
  for (const s of [video, book]) if (s) spaceById.set(s.id, s);
  const bookSpaceIds = new Set([...spaceById.values()].filter((s) => s.kind === "book").map((s) => s.id));
  return { videoSpaceId: video?.id ?? null, bookSpaceId: book?.id ?? null, spaceById, bookSpaceIds };
}

/** Re-read a space after a kind change (adoption mutates the row). */
export function getSpace(id: string): Space | undefined {
  return db.select().from(spaces).where(eq(spaces.id, id)).all()[0];
}
