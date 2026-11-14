import { describe, it, expect } from "vitest";
import { pickRoute, aiEligibleSpaces } from "./routing";

describe("pickRoute", () => {
  const none = { videoSpaceId: null, groupSpaceId: null, aiSpaceId: null };
  it("prefers rule, then group, then AI", () => {
    expect(
      pickRoute({ videoSpaceId: "v", groupSpaceId: "g", aiSpaceId: "a" })
    ).toEqual({ spaceId: "v", routedBy: "rule" });
    expect(pickRoute({ ...none, groupSpaceId: "g", aiSpaceId: "a" })).toEqual({
      spaceId: "g",
      routedBy: "group",
    });
    expect(pickRoute({ ...none, aiSpaceId: "a" })).toEqual({
      spaceId: "a",
      routedBy: "ai",
    });
  });
  it("returns null when nothing matches", () => {
    expect(pickRoute(none)).toBeNull();
  });
});

describe("aiEligibleSpaces", () => {
  const sp = (
    name: string,
    o: Partial<{
      autoIntake: boolean;
      aiRouting: boolean;
      kind: "general" | "video";
    }> = {}
  ) => ({
    name,
    autoIntake: true,
    aiRouting: true,
    kind: "general" as const,
    ...o,
  });
  it("needs auto-intake, AI routing, and general kind", () => {
    const out = aiEligibleSpaces([
      sp("ok"),
      sp("no-intake", { autoIntake: false }),
      sp("no-ai", { aiRouting: false }),
      sp("video", { kind: "video" }),
    ]);
    expect(out.map((s) => s.name)).toEqual(["ok"]);
  });
});
