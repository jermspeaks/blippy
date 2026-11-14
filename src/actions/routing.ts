"use server";

import { db } from "@/db";
import { routingEvents, routedByValues } from "@/db/schema";
import { count, desc, eq, isNull } from "drizzle-orm";

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
