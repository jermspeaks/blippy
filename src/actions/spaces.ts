"use server";

import { db } from "@/db";
import { blips, blipGroups, spaces } from "@/db/schema";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { Db } from "@/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const spaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  autoIntake: z.boolean(),
});

function revalidateAll(spaceId?: string) {
  revalidatePath("/");
  revalidatePath("/spaces");
  if (spaceId) revalidatePath(`/spaces/${spaceId}`);
}

/**
 * Store every unstored, active blip belonging to a group linked to this space.
 * This is what makes "all the blips in that group" land in the space.
 */
function sweepSpace(tx: Tx, spaceId: string): number {
  const groupIds = tx
    .select({ id: blipGroups.id })
    .from(blipGroups)
    .where(eq(blipGroups.spaceId, spaceId))
    .all()
    .map((g) => g.id);
  if (groupIds.length === 0) return 0;
  const res = tx
    .update(blips)
    .set({ spaceId, updatedAt: new Date() })
    .where(
      and(
        inArray(blips.groupId, groupIds),
        isNull(blips.spaceId),
        eq(blips.status, "active")
      )
    )
    .run();
  return res.changes;
}

async function nameTaken(name: string, exceptId?: string) {
  const rows = await db.select().from(spaces);
  return rows.some(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== exceptId
  );
}

export async function listSpaces() {
  return db.select().from(spaces).orderBy(asc(spaces.name));
}

export async function listSpacesWithCounts() {
  const rows = await listSpaces();
  const counts = await db
    .select({ spaceId: blips.spaceId, n: count() })
    .from(blips)
    .where(sql`${blips.spaceId} IS NOT NULL`)
    .groupBy(blips.spaceId);
  const byId = new Map(counts.map((c) => [c.spaceId, c.n]));
  const groupRows = await db
    .select({ spaceId: blipGroups.spaceId, n: count() })
    .from(blipGroups)
    .where(sql`${blipGroups.spaceId} IS NOT NULL`)
    .groupBy(blipGroups.spaceId);
  const groupsById = new Map(groupRows.map((g) => [g.spaceId, g.n]));
  return rows.map((s) => ({
    ...s,
    blipCount: byId.get(s.id) ?? 0,
    groupCount: groupsById.get(s.id) ?? 0,
  }));
}

export async function getSpaceDetail(id: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, id)).limit(1);
  if (!space) return null;
  const rows = await db
    .select({ blip: blips, groupLabel: blipGroups.label })
    .from(blips)
    .leftJoin(blipGroups, eq(blips.groupId, blipGroups.id))
    .where(eq(blips.spaceId, id))
    .orderBy(asc(blips.createdAt));
  const allGroups = await db.select().from(blipGroups).orderBy(asc(blipGroups.label));
  return {
    space,
    blips: rows.map((r) => ({ ...r.blip, groupLabel: r.groupLabel })),
    linkedGroups: allGroups.filter((g) => g.spaceId === id),
    // Groups not claimed by any space, available to link here.
    availableGroups: allGroups.filter((g) => g.spaceId === null),
  };
}

export async function createSpace(input: {
  name: string;
  description?: string | null;
  autoIntake: boolean;
}) {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  if (await nameTaken(parsed.data.name)) {
    return { ok: false as const, error: "A space with that name already exists" };
  }
  const id = randomUUID();
  let pulled = 0;
  db.transaction((tx) => {
    tx.insert(spaces)
      .values({
        id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        autoIntake: parsed.data.autoIntake,
        createdAt: new Date(),
      })
      .run();
    // A topic group with the same name is the obvious home for this space.
    const match = tx
      .select()
      .from(blipGroups)
      .where(and(isNull(blipGroups.spaceId), sql`lower(${blipGroups.label}) = ${parsed.data.name.toLowerCase()}`))
      .all()[0];
    if (match) {
      tx.update(blipGroups).set({ spaceId: id }).where(eq(blipGroups.id, match.id)).run();
      if (parsed.data.autoIntake) pulled = sweepSpace(tx, id);
    }
  });
  revalidateAll();
  return { ok: true as const, id, pulled };
}

export async function updateSpace(
  id: string,
  input: { name: string; description?: string | null; autoIntake: boolean }
) {
  const parsed = spaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  if (await nameTaken(parsed.data.name, id)) {
    return { ok: false as const, error: "A space with that name already exists" };
  }
  let pulled = 0;
  db.transaction((tx) => {
    tx.update(spaces)
      .set({
        name: parsed.data.name,
        description: parsed.data.description || null,
        autoIntake: parsed.data.autoIntake,
      })
      .where(eq(spaces.id, id))
      .run();
    if (parsed.data.autoIntake) pulled = sweepSpace(tx, id);
  });
  revalidateAll(id);
  return { ok: true as const, pulled };
}

/** Deleting a space returns its blips to the feed and frees its groups. */
export async function deleteSpace(id: string) {
  db.transaction((tx) => {
    tx.update(blips).set({ spaceId: null, updatedAt: new Date() }).where(eq(blips.spaceId, id)).run();
    tx.update(blipGroups).set({ spaceId: null }).where(eq(blipGroups.spaceId, id)).run();
    tx.delete(spaces).where(eq(spaces.id, id)).run();
  });
  revalidateAll();
  return { ok: true as const };
}

export async function linkGroupToSpace(spaceId: string, groupId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { ok: false as const, error: "Space not found" };
  let pulled = 0;
  db.transaction((tx) => {
    tx.update(blipGroups).set({ spaceId }).where(eq(blipGroups.id, groupId)).run();
    if (space.autoIntake) pulled = sweepSpace(tx, spaceId);
  });
  revalidateAll(spaceId);
  return { ok: true as const, pulled };
}

/** Unlinking stops future intake; blips already stored stay in the space. */
export async function unlinkGroupFromSpace(spaceId: string, groupId: string) {
  await db
    .update(blipGroups)
    .set({ spaceId: null })
    .where(and(eq(blipGroups.id, groupId), eq(blipGroups.spaceId, spaceId)));
  revalidateAll(spaceId);
  return { ok: true as const };
}

export async function storeBlip(blipId: string, spaceId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { ok: false as const, error: "Space not found" };
  await db
    .update(blips)
    .set({ spaceId, updatedAt: new Date() })
    .where(eq(blips.id, blipId));
  revalidateAll(spaceId);
  return { ok: true as const, spaceName: space.name };
}

/** Return a stored blip to the feed. */
export async function unstoreBlip(blipId: string, spaceId: string) {
  await db
    .update(blips)
    .set({ spaceId: null, nextReviewAt: null, updatedAt: new Date() })
    .where(and(eq(blips.id, blipId), eq(blips.spaceId, spaceId)));
  revalidateAll(spaceId);
  return { ok: true as const };
}
