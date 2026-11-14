"use server";

import { db } from "@/db";
import { blips, blipGroups } from "@/db/schema";
import {
  createBlipSchema,
  updateBlipSchema,
  snoozeBlipSchema,
} from "@/lib/validations";
import { eq, and, or, lte, gt, sql, asc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

const FEED_CAP = 50;

export async function createBlip(formData: FormData) {
  const raw = { content: formData.get("content") as string };
  const parsed = createBlipSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }
  const now = new Date();
  const id = randomUUID();
  await db.insert(blips).values({
    id,
    content: parsed.data.content,
    status: "active",
    nextReviewAt: null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath("/");
  revalidatePath("/feed");
  return { ok: true as const, id };
}

export async function updateBlip(id: string, formData: FormData) {
  const raw = {
    content: formData.get("content") as string | undefined,
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
      ...(parsed.data.content !== undefined && {
        content: parsed.data.content,
      }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      updatedAt: now,
    })
    .where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/blips/${id}`);
  return { ok: true as const };
}

export async function deleteBlip(id: string) {
  await db.delete(blips).where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
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

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getFeedBlips() {
  const today = endOfToday();

  const dueOrNull = or(
    lte(blips.nextReviewAt, today),
    sql`${blips.nextReviewAt} IS NULL`
  );
  // Blips stored in a space leave the feed.
  const active = and(eq(blips.status, "active"), isNull(blips.spaceId));
  const conditions = and(active, dueOrNull);

  const rows = await db
    .select({ blip: blips, groupLabel: blipGroups.label })
    .from(blips)
    .leftJoin(blipGroups, eq(blips.groupId, blipGroups.id))
    .where(conditions)
    .orderBy(asc(blips.nextReviewAt), asc(blips.createdAt))
    .limit(FEED_CAP);

  return rows.map((r) => ({ ...r.blip, groupLabel: r.groupLabel }));
}

export async function getBlipById(id: string) {
  const [row] = await db.select().from(blips).where(eq(blips.id, id)).limit(1);
  return row ?? null;
}

/** Feed blips hidden until a later day (snoozed past today), soonest first. */
export async function listSnoozedBlips() {
  return db
    .select()
    .from(blips)
    .where(
      and(
        eq(blips.status, "active"),
        isNull(blips.spaceId),
        gt(blips.nextReviewAt, endOfToday())
      )
    )
    .orderBy(asc(blips.nextReviewAt), asc(blips.createdAt));
}

/** Clear the snooze so the blip is due in the feed again. */
export async function unsnoozeBlip(id: string) {
  await db
    .update(blips)
    .set({ nextReviewAt: null, updatedAt: new Date() })
    .where(eq(blips.id, id));
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/spaces/snoozed");
  revalidatePath(`/blips/${id}`);
  return { ok: true as const };
}
