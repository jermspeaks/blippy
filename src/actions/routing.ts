"use server";

import { db } from "@/db";
import {
  routingEvents,
  routingRules,
  routedByValues,
  spaces,
  blipGroups,
} from "@/db/schema";
import { asc, count, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { normalizePattern } from "@/lib/routing";

export type RoutingFilter = "all" | "inbox" | (typeof routedByValues)[number];
const LOG_LIMIT = 200;

export async function listRoutingEvents(filter: RoutingFilter = "all") {
  const where =
    filter === "all"
      ? undefined
      : filter === "inbox"
        ? isNull(routingEvents.routedBy)
        : eq(routingEvents.routedBy, filter);
  return db
    .select()
    .from(routingEvents)
    .where(where)
    .orderBy(desc(routingEvents.createdAt))
    .limit(LOG_LIMIT);
}

/** Totals per outcome across the whole log, for monitoring the system. */
export async function routingTotals() {
  const rows = await db
    .select({ routedBy: routingEvents.routedBy, n: count() })
    .from(routingEvents)
    .groupBy(routingEvents.routedBy);
  const by = new Map(rows.map((r) => [r.routedBy ?? "inbox", r.n]));
  return {
    rule: by.get("rule") ?? 0,
    group: by.get("group") ?? 0,
    ai: by.get("ai") ?? 0,
    inbox: by.get("inbox") ?? 0,
  };
}

export async function listRoutingRules() {
  return db
    .select({
      id: routingRules.id,
      pattern: routingRules.pattern,
      spaceId: routingRules.spaceId,
      spaceName: spaces.name,
    })
    .from(routingRules)
    .innerJoin(spaces, eq(routingRules.spaceId, spaces.id))
    .orderBy(asc(routingRules.pattern));
}

export async function createRoutingRule(input: {
  pattern: string;
  spaceId: string;
}) {
  const pattern = normalizePattern(input.pattern);
  if (!pattern) {
    return {
      ok: false as const,
      error: 'Enter a site like "github.com" or "github.com/vercel"',
    };
  }
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, input.spaceId))
    .limit(1);
  if (!space) return { ok: false as const, error: "Pick a space" };
  const [dupe] = await db
    .select()
    .from(routingRules)
    .where(eq(routingRules.pattern, pattern))
    .limit(1);
  if (dupe)
    return {
      ok: false as const,
      error: `A rule for ${pattern} already exists`,
    };
  await db.insert(routingRules).values({
    id: randomUUID(),
    pattern,
    spaceId: space.id,
    createdAt: new Date(),
  });
  revalidatePath("/routing");
  return { ok: true as const, pattern };
}

export async function deleteRoutingRule(id: string) {
  await db.delete(routingRules).where(eq(routingRules.id, id));
  revalidatePath("/routing");
  return { ok: true as const };
}

/** Each space with its linked topic groups, for explaining how links reach it. */
export async function listSpaceRouting() {
  const [spaceRows, groupRows] = await Promise.all([
    db.select().from(spaces).orderBy(asc(spaces.name)),
    db.select().from(blipGroups).orderBy(asc(blipGroups.label)),
  ]);
  return spaceRows.map((s) => ({
    ...s,
    groups: groupRows.filter((g) => g.spaceId === s.id).map((g) => g.label),
  }));
}
