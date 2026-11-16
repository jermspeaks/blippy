import type { RoutedBy, Space } from "@/db/schema";

/**
 * Normalize a rule pattern to `host[/path]`: lowercase, no scheme, `www.`,
 * query, hash or trailing slash. Returns null when it isn't a plausible
 * host (needs a dot, e.g. "github.com").
 */
export function normalizePattern(input: string): string | null {
  const p = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(p) ? p : null;
}

/**
 * First rule matching the URL: the host equals the pattern's host (or is a
 * subdomain of it) and, if the pattern has a path, the URL path starts with it
 * at a segment boundary. Longer (more specific) patterns win.
 */
export function matchRule<T extends { pattern: string }>(
  url: string,
  rules: T[]
): T | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "").toLowerCase();
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  return (
    sorted.find((r) => {
      const slash = r.pattern.indexOf("/");
      const ruleHost = slash === -1 ? r.pattern : r.pattern.slice(0, slash);
      const rulePath = slash === -1 ? "" : r.pattern.slice(slash);
      if (host !== ruleHost && !host.endsWith(`.${ruleHost}`)) return false;
      return !rulePath || path === rulePath || path.startsWith(`${rulePath}/`);
    }) ?? null
  );
}

export type Route = {
  spaceId: string;
  routedBy: RoutedBy;
  reason: string;
} | null;

/**
 * Decide where a captured link goes. First match wins:
 *  0. a user domain rule (e.g. github.com -> Dev Tools)
 *  1. kind rules (video link -> video space, book link -> book space)
 *  2. its topic group is linked to a space
 *  3. the AI matched it to an existing space
 * Otherwise it stays in the feed (inbox) for triage.
 */
export function pickRoute(opts: {
  domainRule?: { spaceId: string; pattern: string } | null;
  videoSpaceId: string | null;
  bookSpaceId?: string | null;
  /** Why the book space was chosen (default "Book link"). */
  bookReason?: string;
  /**
   * Book spaces. The topic-group and AI routes may not place a blip here, since
   * those only guess; a book is placed by `bookSpaceId` after it is verified.
   */
  bookSpaceIds?: ReadonlySet<string>;
  groupSpaceId: string | null;
  aiSpaceId: string | null;
  groupLabel?: string | null;
  aiReason?: string | null;
}): Route {
  if (opts.domainRule) {
    return {
      spaceId: opts.domainRule.spaceId,
      routedBy: "rule",
      reason: `Domain rule: ${opts.domainRule.pattern}`,
    };
  }
  if (opts.videoSpaceId) {
    return {
      spaceId: opts.videoSpaceId,
      routedBy: "rule",
      reason: "Video link (YouTube)",
    };
  }
  if (opts.bookSpaceId) {
    return { spaceId: opts.bookSpaceId, routedBy: "rule", reason: opts.bookReason ?? "Book link" };
  }
  const guessed = (id: string | null) => id && !opts.bookSpaceIds?.has(id) ? id : null;
  const groupSpaceId = guessed(opts.groupSpaceId);
  const aiSpaceId = guessed(opts.aiSpaceId);
  if (groupSpaceId) {
    return {
      spaceId: groupSpaceId,
      routedBy: "group",
      reason: opts.groupLabel
        ? `Topic group "${opts.groupLabel}" is linked to this space`
        : "Its topic group is linked to this space",
    };
  }
  if (aiSpaceId) {
    return {
      spaceId: aiSpaceId,
      routedBy: "ai",
      reason: opts.aiReason || "AI matched the space name and description",
    };
  }
  return null;
}

/** Why a link stayed in the feed. */
export function inboxReason(aiRan: boolean): string {
  return aiRan
    ? "No space matched; left in the feed"
    : "AI unavailable; left in the feed";
}

/**
 * Spaces the AI may route into: general and book spaces with auto-intake and
 * AI routing both on (video routes by rule).
 */
export function aiEligibleSpaces<
  T extends Pick<Space, "autoIntake" | "aiRouting" | "kind">,
>(allSpaces: T[]): T[] {
  return allSpaces.filter(
    (s) => s.autoIntake && s.aiRouting && s.kind !== "video"
  );
}
