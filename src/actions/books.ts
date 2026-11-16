"use server";

import { db } from "@/db";
import { blips, bookDetails, spaces } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { searchBooks, type BookInfo } from "@/lib/book-lookup";
import { hydrateBooks, hydratePendingBooks, pendingBookBlips } from "@/lib/book-hydrate";

function revalidateSpace(spaceId: string | null) {
  revalidatePath("/");
  revalidatePath("/spaces");
  if (spaceId) revalidatePath(`/spaces/${spaceId}`);
}

/** Look up details for blips in this book space that were never looked up. */
export async function fetchMissingBookDetails(spaceId: string) {
  const pending = pendingBookBlips(50, spaceId).length;
  const counts = await hydratePendingBooks(50, spaceId);
  revalidateSpace(spaceId);
  return {
    ok: true as const,
    attempted: pending,
    found: counts.ok + counts.partial,
    failed: counts.failed,
  };
}

/** Retry the lookup for one book. */
export async function refreshBook(blipId: string) {
  const [blip] = await db.select().from(blips).where(eq(blips.id, blipId)).limit(1);
  if (!blip) return { ok: false as const, error: "Blip not found" };
  // A successful lookup replaces earlier details; a failed one keeps them.
  const counts = await hydrateBooks([blip]);
  revalidateSpace(blip.spaceId);
  return {
    ok: true as const,
    found: counts.failed === 0,
  };
}

/** Candidates for the "Add book" box: an ISBN, or a title/author query. */
export async function searchBookCandidates(query: string) {
  if (!query.trim()) return { ok: true as const, books: [] as BookInfo[] };
  const books = await searchBooks(query);
  return { ok: true as const, books };
}

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), "https only")
  .nullable();
const candidateSchema = z.object({
  title: z.string().min(1).max(300),
  subtitle: z.string().max(500).nullable(),
  authors: z.array(z.string().max(200)).max(20),
  isbn13: z.string().regex(/^\d{13}$/).nullable(),
  publisher: z.string().max(200).nullable(),
  publishedYear: z.number().int().nullable(),
  pageCount: z.number().int().nullable(),
  description: z.string().nullable(),
  coverUrl: httpsUrl,
  infoUrl: httpsUrl,
});

/** Add a picked candidate to a book space. Skips a book that is already there (same ISBN or link). */
export async function addBook(spaceId: string, candidate: BookInfo) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space || space.kind !== "book") return { ok: false as const, error: "Not a book space" };
  const parsed = candidateSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false as const, error: "Invalid book" };
  const b = parsed.data;

  const dupes = await db
    .select({ blipUrl: blips.url, isbn13: bookDetails.isbn13 })
    .from(blips)
    .leftJoin(bookDetails, eq(bookDetails.blipId, blips.id))
    .where(ne(blips.status, "fizzled"));
  if (dupes.some((d) => (b.isbn13 && d.isbn13 === b.isbn13) || (b.infoUrl && d.blipUrl === b.infoUrl))) {
    return { ok: false as const, error: `"${b.title}" is already saved` };
  }

  const now = new Date();
  const id = randomUUID();
  db.transaction((tx) => {
    tx.insert(blips)
      .values({
        id,
        content: b.infoUrl ? `[${b.title}](${b.infoUrl})` : b.title,
        title: b.title,
        summary: b.description?.slice(0, 500) ?? null,
        imageUrl: b.coverUrl,
        url: b.infoUrl,
        spaceId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.insert(bookDetails)
      .values({
        blipId: id,
        isbn13: b.isbn13,
        authors: JSON.stringify(b.authors),
        publisher: b.publisher,
        publishedYear: b.publishedYear,
        pageCount: b.pageCount,
        lookupStatus: "ok",
        fetchedAt: now,
      })
      .run();
  });
  revalidateSpace(spaceId);
  return { ok: true as const, id, title: b.title };
}
