"use server";

import { db } from "@/db";
import { blips, blipGroups, spaces, spaceKinds, routingRules } from "@/db/schema";
import { sweepVideoBlips } from "@/lib/video-space";
import { and, asc, count, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { Db } from "@/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const spaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  autoIntake: z.boolean(),
  aiRouting: z.boolean().optional(),
  kind: z.enum(spaceKinds).default("general"),
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
    .select({ spaceId: blips.spaceId, n: count(), lastAddedAt: max(blips.createdAt) })
    .from(blips)
    .where(and(sql`${blips.spaceId} IS NOT NULL`, ne(blips.status, "fizzled")))
    .groupBy(blips.spaceId);
  const byId = new Map(counts.map((c) => [c.spaceId, c.n]));
  const lastById = new Map(counts.map((c) => [c.spaceId, c.lastAddedAt]));
  const groupRows = await db
    .select({ spaceId: blipGroups.spaceId, n: count() })
    .from(blipGroups)
    .where(sql`${blipGroups.spaceId} IS NOT NULL`)
    .groupBy(blipGroups.spaceId);
  const groupsById = new Map(groupRows.map((g) => [g.spaceId, g.n]));
  return rows.map((s) => ({
    ...s,
    blipCount: byId.get(s.id) ?? 0,
    // Newest "added" date among the space's blips (what the space page shows).
    lastAddedAt: lastById.get(s.id) ?? null,
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
    .where(and(eq(blips.spaceId, id), ne(blips.status, "fizzled")))
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
  kind?: (typeof spaceKinds)[number];
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
        kind: parsed.data.kind,
        createdAt: new Date(),
      })
      .run();
    if (parsed.data.kind === "video" && parsed.data.autoIntake) pulled += sweepVideoBlips(tx, id);
    // A topic group with the same name is the obvious home for this space.
    const match = tx
      .select()
      .from(blipGroups)
      .where(and(isNull(blipGroups.spaceId), sql`lower(${blipGroups.label}) = ${parsed.data.name.toLowerCase()}`))
      .all()[0];
    if (match) {
      tx.update(blipGroups).set({ spaceId: id }).where(eq(blipGroups.id, match.id)).run();
      if (parsed.data.autoIntake) pulled += sweepSpace(tx, id);
    }
  });
  revalidateAll();
  return { ok: true as const, id, pulled };
}

export async function updateSpace(
  id: string,
  input: {
    name: string;
    description?: string | null;
    autoIntake: boolean;
    aiRouting?: boolean;
  }
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
        ...(parsed.data.aiRouting !== undefined && { aiRouting: parsed.data.aiRouting }),
      })
      .where(eq(spaces.id, id))
      .run();
    if (parsed.data.autoIntake) {
      pulled = sweepSpace(tx, id);
      const kind = tx.select({ kind: spaces.kind }).from(spaces).where(eq(spaces.id, id)).get()?.kind;
      if (kind === "video") pulled += sweepVideoBlips(tx, id);
    }
  });
  revalidateAll(id);
  return { ok: true as const, pulled };
}

/** Deleting a space returns its blips to the feed, frees its groups and drops its routing rules. */
export async function deleteSpace(id: string) {
  db.transaction((tx) => {
    tx.update(blips).set({ spaceId: null, updatedAt: new Date() }).where(eq(blips.spaceId, id)).run();
    tx.update(blipGroups).set({ spaceId: null }).where(eq(blipGroups.spaceId, id)).run();
    tx.delete(routingRules).where(eq(routingRules.spaceId, id)).run();
    tx.delete(spaces).where(eq(spaces.id, id)).run();
  });
  revalidateAll();
  revalidatePath("/routing");
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
  const [blip] = await db.select().from(blips).where(eq(blips.id, blipId)).limit(1);
  await db
    .update(blips)
    .set({ spaceId, routedBy: null, routedReason: null, updatedAt: new Date() })
    .where(eq(blips.id, blipId));
  revalidateAll(spaceId);

  // Learning loop: if the blip's topic group isn't linked to any space yet,
  // offer to link it so future captures (and its siblings) route here.
  let suggestGroup: { id: string; label: string; others: number } | null = null;
  if (blip?.groupId) {
    const [group] = await db.select().from(blipGroups).where(eq(blipGroups.id, blip.groupId)).limit(1);
    if (group && group.spaceId === null) {
      const others = await db
        .select({ n: count() })
        .from(blips)
        .where(
          and(
            eq(blips.groupId, group.id),
            isNull(blips.spaceId),
            eq(blips.status, "active"),
            sql`${blips.id} <> ${blipId}`
          )
        );
      suggestGroup = { id: group.id, label: group.label, others: others[0]?.n ?? 0 };
    }
  }
  return { ok: true as const, spaceName: space.name, suggestGroup };
}

/** Return a stored blip to the feed. */
export async function unstoreBlip(blipId: string, spaceId: string) {
  await db
    .update(blips)
    .set({ spaceId: null, routedBy: null, routedReason: null, nextReviewAt: null, updatedAt: new Date() })
    .where(and(eq(blips.id, blipId), eq(blips.spaceId, spaceId)));
  revalidateAll(spaceId);
  return { ok: true as const };
}

/**
 * Triage a topic group: link it to the space and move all of its unstored,
 * active blips there (regardless of the space's auto-intake switch, since the
 * user asked explicitly). The group label is dropped from moved blips; the
 * group itself stays linked so future captures with that label route here.
 */
function routeGroup(tx: Tx, groupId: string, spaceId: string): number {
  tx.update(blipGroups).set({ spaceId }).where(eq(blipGroups.id, groupId)).run();
  return tx
    .update(blips)
    .set({ spaceId, groupId: null, routedBy: null, routedReason: null, updatedAt: new Date() })
    .where(and(eq(blips.groupId, groupId), isNull(blips.spaceId), eq(blips.status, "active")))
    .run().changes;
}

export async function routeGroupToSpace(groupId: string, spaceId: string) {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return { ok: false as const, error: "Space not found" };
  const [group] = await db.select().from(blipGroups).where(eq(blipGroups.id, groupId)).limit(1);
  if (!group) return { ok: false as const, error: "Group not found" };
  const moved = db.transaction((tx) => routeGroup(tx, groupId, spaceId));
  revalidateAll(spaceId);
  return { ok: true as const, moved, spaceName: space.name };
}

/** Turn a topic group into a new space, moving its blips there. */
export async function createSpaceFromGroup(
  groupId: string,
  input: {
    name: string;
    description?: string | null;
    kind?: (typeof spaceKinds)[number];
  }
) {
  const parsed = spaceSchema.safeParse({ ...input, autoIntake: true });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const [group] = await db.select().from(blipGroups).where(eq(blipGroups.id, groupId)).limit(1);
  if (!group) return { ok: false as const, error: "Group not found" };
  if (await nameTaken(parsed.data.name)) {
    return { ok: false as const, error: "A space with that name already exists" };
  }
  const id = randomUUID();
  const moved = db.transaction((tx) => {
    tx.insert(spaces)
      .values({
        id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        kind: parsed.data.kind,
        autoIntake: true,
        createdAt: new Date(),
      })
      .run();
    let n = routeGroup(tx, groupId, id);
    if (parsed.data.kind === "video") n += sweepVideoBlips(tx, id);
    return n;
  });
  revalidateAll(id);
  return { ok: true as const, id, moved };
}
