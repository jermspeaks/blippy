import { describe, it, expect, vi } from "vitest";

vi.mock("./providers", () => ({
  generateJson: vi.fn(async () => ({
    blips: [
      { id: 0, title: "A", summary: null, group: "AI Coding" },
      { id: 1, title: "B", summary: "s", group: "AI Coding" },
      { id: 2, title: null, summary: null, group: "Lonely" },
      "garbage",
    ],
  })),
}));

import { organizeLinks } from "./organize";

const input = (id: number) => ({
  id,
  url: `https://x.com/${id}`,
  linkText: "",
  nested: false,
  og: { title: null, description: null, siteName: null },
});

describe("organizeLinks", () => {
  it("tolerates nulls, skips junk entries, drops singleton groups", async () => {
    const out = await organizeLinks(
      { provider: "openai", model: "m" },
      [input(0), input(1), input(2)],
      []
    );
    expect(out.get(0)).toEqual({ title: "A", summary: "", group: "AI Coding" });
    expect(out.get(1)?.group).toBe("AI Coding");
    expect(out.get(2)?.group).toBeNull();
  });
});
