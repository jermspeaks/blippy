"use server";

import { db } from "@/db";
import { blips, readingItems, readingStatuses, type ReadingStatus } from "@/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractArticle } from "@/lib/article";
import { importMarkdown } from "@/actions/capture";

function revalidateReading(id?: string) {
  revalidatePath("/");
  revalidatePath("/reading");
  revalidatePath("/spaces");
  if (id) revalidatePath(`/reading/${id}`);
}

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Only http and https links");

/** Extract the article for this blip's link and save it. Failure is saved as a state (retry from the item). */
async function saveItemFor(blip: typeof blips.$inferSelect) {
  const url = blip.url!;
  const result = await extractArticle(url);
  const now = new Date();
  const base = { blipId: blip.id, url, addedAt: now, fetchedAt: now, status: "unread" as const };
  const values = result.ok
    ? {
        ...base,
        title: result.article.title,
        byline: result.article.byline,
        siteName: result.article.siteName ?? blip.siteName,
        leadImageUrl: result.article.leadImageUrl ?? blip.imageUrl,
        excerpt: result.article.excerpt,
        contentHtml: result.article.contentHtml,
        wordCount: result.article.wordCount,
        readingMinutes: result.article.readingMinutes,
        extractStatus: "ok" as const,
        extractError: null,
      }
    : {
        ...base,
        title: blip.title ?? url,
        byline: null,
        siteName: blip.siteName,
        leadImageUrl: blip.imageUrl,
        excerpt: blip.summary,
        contentHtml: null,
        wordCount: null,
        readingMinutes: null,
        extractStatus: "failed" as const,
        extractError: result.reason,
      };
  const id = randomUUID();
  db.insert(readingItems).values({ id, ...values }).run();
  return { id, extracted: result.ok };
}

/** Add a blip's article to the reading list. Adding twice returns the existing item. */
export async function addToReadingList(blipId: string) {
  const [blip] = await db.select().from(blips).where(eq(blips.id, blipId)).limit(1);
  if (!blip) return { ok: false as const, error: "Blip not found" };
  if (!blip.url) return { ok: false as const, error: "This blip has no link to read" };
  const [existing] = await db.select().from(readingItems).where(eq(readingItems.blipId, blipId)).limit(1);
  if (existing) return { ok: true as const, id: existing.id, extracted: existing.extractStatus === "ok" };
  const saved = await saveItemFor(blip);
  revalidateReading(saved.id);
  return { ok: true as const, ...saved };
}

/** Paste a link: reuse its blip or capture it as a new blip first, then add it to the list. */
export async function addUrlToReadingList(rawUrl: string) {
  const parsed = httpUrl.safeParse(rawUrl);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid link" };
  const url = parsed.data;
  let [blip] = await db.select().from(blips).where(eq(blips.url, url)).limit(1);
  if (!blip) {
    const r = await importMarkdown(`[${url}](${url})`);
    if (!r.ok) return { ok: false as const, error: r.error };
    [blip] = await db.select().from(blips).where(eq(blips.url, url)).limit(1);
    if (!blip) return { ok: false as const, error: "Couldn't save that link" };
  }
  return addToReadingList(blip.id);
}

export async function listReadingItems(status?: ReadingStatus) {
  const rows = await db
    .select({
      id: readingItems.id,
      blipId: readingItems.blipId,
      url: readingItems.url,
      title: readingItems.title,
      byline: readingItems.byline,
      siteName: readingItems.siteName,
      excerpt: readingItems.excerpt,
      wordCount: readingItems.wordCount,
      readingMinutes: readingItems.readingMinutes,
      scrollPct: readingItems.scrollPct,
      extractStatus: readingItems.extractStatus,
      extractError: readingItems.extractError,
      status: readingItems.status,
      addedAt: readingItems.addedAt,
      readAt: readingItems.readAt,
    })
    .from(readingItems)
    .where(status ? eq(readingItems.status, status) : undefined)
    .orderBy(desc(readingItems.addedAt));
  return rows;
}

export async function readingCounts() {
  const rows = await db.select({ status: readingItems.status }).from(readingItems);
  const counts: Record<ReadingStatus, number> = { unread: 0, reading: 0, read: 0, archived: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

export async function getReadingItem(id: string) {
  const [item] = await db.select().from(readingItems).where(eq(readingItems.id, id)).limit(1);
  return item ?? null;
}

/** blip id -> reading item id, for the "In reading list" marker. */
export async function readingItemIdsByBlip(blipIds: string[]): Promise<Record<string, string>> {
  if (blipIds.length === 0) return {};
  const rows = await db
    .select({ blipId: readingItems.blipId, id: readingItems.id })
    .from(readingItems)
    .where(and(inArray(readingItems.blipId, blipIds), isNotNull(readingItems.blipId)));
  return Object.fromEntries(rows.map((r) => [r.blipId, r.id]));
}

export async function setReadingStatus(id: string, status: ReadingStatus) {
  if (!z.enum(readingStatuses).safeParse(status).success) return { ok: false as const, error: "Invalid status" };
  const res = await db
    .update(readingItems)
    .set({
      status,
      readAt: status === "read" ? new Date() : null,
      // Moving back to Unread starts the article over.
      ...(status === "unread" ? { scrollPct: 0 } : {}),
    })
    .where(eq(readingItems.id, id))
    .run();
  if (res.changes === 0) return { ok: false as const, error: "Not found" };
  revalidateReading(id);
  return { ok: true as const };
}

/** Delete the saved copy (the blip stays). The UI confirms first. */
export async function removeFromReadingList(id: string) {
  await db.delete(readingItems).where(eq(readingItems.id, id));
  revalidateReading();
  return { ok: true as const };
}

/** Re-run extraction (for a failed item, or to refresh a changed page). */
export async function retryExtraction(id: string) {
  const item = await getReadingItem(id);
  if (!item) return { ok: false as const, error: "Not found" };
  const result = await extractArticle(item.url);
  if (!result.ok) {
    // A failed refresh keeps an earlier good copy; only a failed item records the new reason.
    if (item.extractStatus === "failed") {
      await db
        .update(readingItems)
        .set({ extractError: result.reason, fetchedAt: new Date() })
        .where(eq(readingItems.id, id));
    }
    revalidateReading(id);
    return { ok: false as const, error: result.reason };
  }
  const a = result.article;
  await db
    .update(readingItems)
    .set({
      title: a.title,
      byline: a.byline,
      siteName: a.siteName ?? item.siteName,
      leadImageUrl: a.leadImageUrl ?? item.leadImageUrl,
      excerpt: a.excerpt,
      contentHtml: a.contentHtml,
      wordCount: a.wordCount,
      readingMinutes: a.readingMinutes,
      extractStatus: "ok",
      extractError: null,
      fetchedAt: new Date(),
    })
    .where(eq(readingItems.id, id));
  revalidateReading(id);
  return { ok: true as const };
}

/** Pages scrolled past this fraction count as started: an unread article becomes "reading". */
const STARTED_PCT = 0.02;

/**
 * Remember how far you got. Saved only while the article is unread or being
 * read (rereading a finished one does not overwrite anything). The first real
 * scroll moves an unread article to "reading"; finishing is always explicit.
 */
export async function saveReadingProgress(id: string, pct: number) {
  const parsed = z.number().finite().safeParse(pct);
  if (!parsed.success) return { ok: false as const, error: "Invalid progress" };
  const clamped = Math.min(1, Math.max(0, parsed.data));
  const item = await getReadingItem(id);
  if (!item) return { ok: false as const, error: "Not found" };
  if (item.status === "read" || item.status === "archived") {
    return { ok: true as const, status: item.status, saved: false as const };
  }
  const status: ReadingStatus =
    item.status === "unread" && clamped >= STARTED_PCT ? "reading" : item.status;
  await db
    .update(readingItems)
    .set({ scrollPct: clamped, status })
    .where(eq(readingItems.id, id));
  return { ok: true as const, status, saved: true as const };
}
