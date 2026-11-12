import { describe, it, expect } from "vitest";
import { buildFeedSections, type FeedBlip } from "./feed-groups";

const b = (id: string, groupId: string | null, label: string | null) =>
  ({ id, groupId, groupLabel: label }) as unknown as FeedBlip;

describe("buildFeedSections", () => {
  it("groups at first member position and unwraps singletons", () => {
    const out = buildFeedSections([
      b("1", "g1", "AI"),
      b("2", null, null),
      b("3", "g1", "AI"),
      b("4", "g2", "Solo"),
    ]);
    expect(out.map((s) => s.type)).toEqual(["group", "single", "single"]);
    expect(out[0].type === "group" && out[0].blips.map((x) => x.id)).toEqual(["1", "3"]);
  });
});
