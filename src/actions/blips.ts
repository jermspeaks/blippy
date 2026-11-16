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
import { endOfToday } from "@/lib/due";
import { isLaterDay } from "@/lib/snooze";
import { getFeedCap } from "@/actions/settings";
import { randomUUID } from "crypto";

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
  if (!isLaterDay(parsed.data.nextReviewAt)) {
    return { ok: false as const, error: "Pick a day after today" };
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


/** Active, unstored blips that are due today or never snoozed. */
function dueFeedCondition() {
  const dueOrNull = or(
    lte(blips.nextReviewAt, endOfToday()),
    sql`${blips.nextReviewAt} IS NULL`
  );
  // Blips stored in a space leave the feed.
  return and(eq(blips.status, "active"), isNull(blips.spaceId), dueOrNull);
}

/** How many blips are due, including any beyond the feed's size limit. */
export async function countDueBlips() {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(blips)
    .where(dueFeedCondition());
  return row?.n ?? 0;
}

export async function getFeedBlips() {
  const conditions = dueFeedCondition();
  const cap = await getFeedCap();

  const rows = await db
    .select({ blip: blips, groupLabel: blipGroups.label })
    .from(blips)
    .leftJoin(blipGroups, eq(blips.groupId, blipGroups.id))
    .where(conditions)
    .orderBy(asc(blips.nextReviewAt), asc(blips.createdAt))
    .limit(cap);

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
