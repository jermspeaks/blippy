import type { RoutedBy, Space } from "@/db/schema";

export type Route = { spaceId: string; routedBy: RoutedBy; reason: string } | null;

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
  groupLabel?: string | null;
  aiReason?: string | null;
}): Route {
  if (opts.videoSpaceId) {
    return { spaceId: opts.videoSpaceId, routedBy: "rule", reason: "Video link (YouTube)" };
  }
  if (opts.groupSpaceId) {
    return {
      spaceId: opts.groupSpaceId,
      routedBy: "group",
      reason: opts.groupLabel
        ? `Topic group "${opts.groupLabel}" is linked to this space`
        : "Its topic group is linked to this space",
    };
  }
  if (opts.aiSpaceId) {
    return {
      spaceId: opts.aiSpaceId,
      routedBy: "ai",
      reason: opts.aiReason || "AI matched the space name and description",
    };
  }
  return null;
}

/** Why a link stayed in the feed. */
export function inboxReason(aiRan: boolean): string {
  return aiRan ? "No space matched; left in the feed" : "AI unavailable; left in the feed";
}

/**
 * Spaces the AI may route into: general spaces with auto-intake and AI routing
 * both on (video routes by rule).
 */
export function aiEligibleSpaces<T extends Pick<Space, "autoIntake" | "aiRouting" | "kind">>(
  allSpaces: T[]
): T[] {
  return allSpaces.filter((s) => s.autoIntake && s.aiRouting && s.kind === "general");
}
