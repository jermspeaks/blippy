"use server";

import { db } from "@/db";
import { highlightColors, readingHighlights, readingItems, type ReadingHighlight } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MAX_QUOTE } from "@/lib/highlight-anchor";

const note = z
  .string()
  .max(2000)
  .transform((s) => s.trim() || null)
  .nullable();
const color = z.enum(highlightColors);

const createSchema = z.object({
  readingItemId: z.string().min(1),
  exact: z.string().min(1).max(MAX_QUOTE),
  prefix: z.string().max(100),
  suffix: z.string().max(100),
  note: note.optional(),
  color: color.default("yellow"),
});

export async function listHighlights(readingItemId: string): Promise<ReadingHighlight[]> {
  return db
    .select()
    .from(readingHighlights)
    .where(eq(readingHighlights.readingItemId, readingItemId))
    .orderBy(asc(readingHighlights.createdAt));
}

/** Save a highlight (text plus the words around it) with an optional note. */
export async function createHighlight(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Couldn't save that highlight" };
  const d = parsed.data;
  const [item] = await db.select({ id: readingItems.id }).from(readingItems).where(eq(readingItems.id, d.readingItemId)).limit(1);
  if (!item) return { ok: false as const, error: "Article not found" };
  const row: ReadingHighlight = {
    id: randomUUID(),
    readingItemId: d.readingItemId,
    exact: d.exact,
    prefix: d.prefix,
    suffix: d.suffix,
    note: d.note ?? null,
    color: d.color,
    createdAt: new Date(),
  };
  db.insert(readingHighlights).values(row).run();
  return { ok: true as const, highlight: row };
}

/** Change a highlight's note and color. */
export async function updateHighlight(id: string, input: { note: string | null; color: string }) {
  const parsed = z.object({ note, color }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid highlight" };
  const [row] = await db
    .update(readingHighlights)
    .set({ note: parsed.data.note, color: parsed.data.color })
    .where(eq(readingHighlights.id, id))
    .returning();
  if (!row) return { ok: false as const, error: "Highlight not found" };
  return { ok: true as const, highlight: row };
}

/** Delete a highlight and its note. The UI confirms first when there is a note. */
export async function deleteHighlight(id: string) {
  await db.delete(readingHighlights).where(eq(readingHighlights.id, id));
  return { ok: true as const };
}
