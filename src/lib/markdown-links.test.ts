import { describe, it, expect } from "vitest";
import { extractLinks } from "./markdown-links";

describe("extractLinks", () => {
  it("extracts markdown links and nested bullets", () => {
    const links = extractLinks(
      "[A](https://a.com/x)\n\n- [B](https://b.com/y)\n"
    );
    expect(links).toEqual([
      { url: "https://a.com/x", text: "A", nested: false },
      { url: "https://b.com/y", text: "B", nested: true },
    ]);
  });

  it("keeps parentheses inside URLs", () => {
    const [l] = extractLinks("[pdf](https://github.com/a/b/c.(z-lib.org).pdf)");
    expect(l.url).toBe("https://github.com/a/b/c.(z-lib.org).pdf");
  });

  it("handles malformed links with no opening bracket", () => {
    const [l] = extractLinks("AIE CODE: Google - YouTube](https://youtu.be/abc)");
    expect(l.url).toBe("https://youtu.be/abc");
    expect(l.text).toContain("AIE CODE");
  });

  it("finds bare URLs and dedupes", () => {
    const links = extractLinks("see https://a.com/z.\nhttps://a.com/z");
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("https://a.com/z");
  });
});
