import { describe, it, expect } from "vitest";
import { pickRoute } from "./routing";

describe("pickRoute", () => {
  const none = { videoSpaceId: null, groupSpaceId: null, aiSpaceId: null };
  it("prefers rule, then group, then AI", () => {
    expect(pickRoute({ videoSpaceId: "v", groupSpaceId: "g", aiSpaceId: "a" })).toEqual({ spaceId: "v", routedBy: "rule" });
    expect(pickRoute({ ...none, groupSpaceId: "g", aiSpaceId: "a" })).toEqual({ spaceId: "g", routedBy: "group" });
    expect(pickRoute({ ...none, aiSpaceId: "a" })).toEqual({ spaceId: "a", routedBy: "ai" });
  });
  it("returns null when nothing matches", () => {
    expect(pickRoute(none)).toBeNull();
  });
});
