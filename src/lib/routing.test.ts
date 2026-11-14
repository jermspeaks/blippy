import { describe, it, expect } from "vitest";
import {
  pickRoute,
  aiEligibleSpaces,
  matchRule,
  normalizePattern,
} from "./routing";

describe("pickRoute", () => {
  const none = { videoSpaceId: null, groupSpaceId: null, aiSpaceId: null };
  it("prefers rule, then group, then AI", () => {
    expect(
      pickRoute({ videoSpaceId: "v", groupSpaceId: "g", aiSpaceId: "a" })
    ).toMatchObject({ spaceId: "v", routedBy: "rule" });
    expect(
      pickRoute({ ...none, groupSpaceId: "g", aiSpaceId: "a" })
    ).toMatchObject({
      spaceId: "g",
      routedBy: "group",
    });
    expect(pickRoute({ ...none, aiSpaceId: "a" })).toMatchObject({
      spaceId: "a",
      routedBy: "ai",
    });
  });
  it("explains each route", () => {
    expect(
      pickRoute({ ...none, groupSpaceId: "g", groupLabel: "Travel" })?.reason
    ).toContain("Travel");
    expect(
      pickRoute({ ...none, aiSpaceId: "a", aiReason: "About recipes" })?.reason
    ).toBe("About recipes");
    expect(pickRoute({ ...none, aiSpaceId: "a" })?.reason).toMatch(
      /AI matched/
    );
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

describe("domain rules", () => {
  it("a domain rule beats the video rule, group and AI", () => {
    const r = pickRoute({
      domainRule: { spaceId: "d", pattern: "github.com" },
      videoSpaceId: "v",
      groupSpaceId: "g",
      aiSpaceId: "a",
    });
    expect(r).toMatchObject({ spaceId: "d", routedBy: "rule" });
    expect(r?.reason).toContain("github.com");
  });

  it("normalizes patterns", () => {
    expect(normalizePattern(" https://www.GitHub.com/ ")).toBe("github.com");
    expect(normalizePattern("github.com/Vercel/?x=1#y")).toBe(
      "github.com/vercel"
    );
    expect(normalizePattern("nodots")).toBeNull();
    expect(normalizePattern("")).toBeNull();
    expect(normalizePattern("not a site.com")).toBeNull();
  });

  it("matches host, subdomains and path prefixes, most specific first", () => {
    const rules = [
      { pattern: "github.com", id: "all" },
      { pattern: "github.com/vercel", id: "vercel" },
    ];
    expect(matchRule("https://github.com/a/b", rules)?.id).toBe("all");
    expect(matchRule("https://www.github.com/a/b", rules)?.id).toBe("all");
    expect(matchRule("https://gist.github.com/x", rules)?.id).toBe("all");
    expect(matchRule("https://github.com/vercel/next.js", rules)?.id).toBe(
      "vercel"
    );
    expect(matchRule("https://github.com/vercel", rules)?.id).toBe("vercel");
    expect(matchRule("https://github.com/vercelfan/x", rules)?.id).toBe("all");
    expect(matchRule("https://notgithub.com/x", rules)).toBeNull();
    expect(matchRule("not a url", rules)).toBeNull();
  });
});
