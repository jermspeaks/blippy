import type { Blip } from "@/db/schema";

export type FeedBlip = Blip & { groupLabel: string | null };

export type FeedSection =
  | { type: "single"; blip: FeedBlip }
  | { type: "group"; groupId: string; label: string; blips: FeedBlip[] };

/**
 * Collapse blips that share a group into one section, placed where the group's
 * first blip appeared. A group with a single visible blip renders as a plain card.
 */
export function buildFeedSections(blips: FeedBlip[]): FeedSection[] {
  const sections: FeedSection[] = [];
  const groups = new Map<string, Extract<FeedSection, { type: "group" }>>();
  for (const blip of blips) {
    if (!blip.groupId || !blip.groupLabel) {
      sections.push({ type: "single", blip });
      continue;
    }
    let section = groups.get(blip.groupId);
    if (!section) {
      section = { type: "group", groupId: blip.groupId, label: blip.groupLabel, blips: [] };
      groups.set(blip.groupId, section);
      sections.push(section);
    }
    section.blips.push(blip);
  }
  return sections.map((s) =>
    s.type === "group" && s.blips.length === 1 ? { type: "single", blip: s.blips[0] } : s
  );
}
