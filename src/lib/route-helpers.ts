import { randomUUID } from "crypto";
import type { Space } from "@/db/schema";
import { aiEligibleSpaces, inboxReason, type Route } from "@/lib/routing";

/** Spaces offered to the AI, with the description it uses to decide. */
export function aiSpaceOptions(allSpaces: Space[]) {
  return aiEligibleSpaces(allSpaces).map((s) => ({
    name: s.name,
    description: s.description,
  }));
}

/** Resolve an AI-returned space name to an eligible space id. */
export function aiSpaceId(
  allSpaces: Space[],
  name: string | null | undefined
): string | null {
  if (!name) return null;
  return (
    aiEligibleSpaces(allSpaces).find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    )?.id ?? null
  );
}

export type RoutingSource = "capture" | "reprocess" | "reroute";

type EventInput = {
  blipId: string;
  blipTitle: string;
  url: string | null;
  route: Route;
  usedAi: boolean;
  spaceName: (id: string) => string | null;
  source: RoutingSource;
  now: Date;
};

/** One audit-log row describing a routing decision (including "stayed in the feed"). */
export function routingEvent(e: EventInput) {
  return {
    id: randomUUID(),
    blipId: e.blipId,
    blipTitle: e.blipTitle,
    url: e.url,
    spaceId: e.route?.spaceId ?? null,
    spaceName: e.route ? e.spaceName(e.route.spaceId) : null,
    routedBy: e.route?.routedBy ?? null,
    reason: e.route?.reason ?? inboxReason(e.usedAi),
    source: e.source,
    createdAt: e.now,
  };
}
