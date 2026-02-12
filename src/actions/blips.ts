"use server";

import { db } from "@/db";
import { blips, categories } from "@/db/schema";
import {
  createBlipSchema,
  updateBlipSchema,
  snoozeBlipSchema,
} from "@/lib/validations";
import { eq, and, or, lte, sql, asc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

const FEED_CAP = 10;

export async function createBlip(formData: FormData) {
  const raw = {
    content: formData.get("content") as string,
    categoryId: formData.get("categoryId") as string | null,
  };
  const parsed = createBlipSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }
  const now = new Date();
  const id = randomUUID();
  await db.insert(blips).values({
    id,
    content: parsed.data.content,
    categoryId: parsed.data.categoryId ?? null,
    status: "active",
    nextReviewAt: null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/categories");
  return { ok: true as const, id };
}

export async function updateBlip(id: string, formData: FormData) {
  const raw = {
    content: formData.get("content") as string | undefined,
    categoryId: formData.get("categoryId") as string | null | undefined,
    status: formData.get("status") as string | undefined,
  };
  const parsed = updateBlipSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }
  const now = new Date();
  await db
    .update(blips)
    .set({
      ...(parsed.data.content !== undefined && { content: parsed.data.content }),
      ...(parsed.data.categoryId !== undefined && {
        categoryId: parsed.data.categoryId,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      updatedAt: now,
    })
    .where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/categories");
  revalidatePath(`/blips/${id}`);
  return { ok: true as const };
}

export async function deleteBlip(id: string) {
  await db.delete(blips).where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/categories");
  return { ok: true as const };
}

export async function snoozeBlip(id: string, nextReviewAt: Date) {
  const parsed = snoozeBlipSchema.safeParse({ nextReviewAt });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }
  await db
    .update(blips)
    .set({
      nextReviewAt: parsed.data.nextReviewAt,
      updatedAt: new Date(),
    })
    .where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/blips/${id}`);
  return { ok: true as const };
}

export async function setBlipFizzled(id: string) {
  await db
    .update(blips)
    .set({ status: "fizzled", updatedAt: new Date() })
    .where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/blips/${id}`);
  return { ok: true as const };
}

export async function getFeedBlips(categoryId?: string | null) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const dueOrNull = or(
    lte(blips.nextReviewAt, today),
    sql`${blips.nextReviewAt} IS NULL`
  );
  const active = eq(blips.status, "active");
  const conditions =
    categoryId != null && categoryId !== ""
      ? categoryId === "uncategorized"
        ? and(active, dueOrNull, sql`${blips.categoryId} IS NULL`)
        : and(active, dueOrNull, eq(blips.categoryId, categoryId))
      : and(active, dueOrNull);

  const rows = await db
    .select()
    .from(blips)
    .where(conditions)
    .orderBy(asc(blips.nextReviewAt), asc(blips.createdAt))
    .limit(FEED_CAP);

  return rows;
}

export async function getBlipById(id: string) {
  const [row] = await db.select().from(blips).where(eq(blips.id, id)).limit(1);
  return row ?? null;
}

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.name);
}

export async function listCategoriesWithBlipCount() {
  const cats = await db.select().from(categories).orderBy(categories.name);
  const counts = await db
    .select({ categoryId: blips.categoryId, count: count() })
    .from(blips)
    .groupBy(blips.categoryId);
  const countMap = new Map(
    counts.map((c) => [c.categoryId ?? "uncategorized", c.count])
  );
  return cats.map((c) => ({
    ...c,
    blipCount: countMap.get(c.id) ?? 0,
  }));
}
