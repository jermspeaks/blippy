import type { RoutedBy } from "@/db/schema";

export type Route = { spaceId: string; routedBy: RoutedBy } | null;

/**
 * Decide where a captured link goes. First match wins:
 *  1. kind rule (video link -> video space)
 *  2. its topic group is linked to a space
 *  3. the AI matched it to an existing space
 * Otherwise it stays in the feed (inbox) for triage.
 */
export function pickRoute(opts: {
  videoSpaceId: string | null;
  groupSpaceId: string | null;
  aiSpaceId: string | null;
}): Route {
  if (opts.videoSpaceId) return { spaceId: opts.videoSpaceId, routedBy: "rule" };
  if (opts.groupSpaceId) return { spaceId: opts.groupSpaceId, routedBy: "group" };
  if (opts.aiSpaceId) return { spaceId: opts.aiSpaceId, routedBy: "ai" };
  return null;
}
