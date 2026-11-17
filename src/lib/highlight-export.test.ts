import { describe, expect, it } from "vitest";
import { exportFileName, highlightsToMarkdown } from "./highlight-export";

describe("highlightsToMarkdown", () => {
  it("lists quotes with notes under a title and source", () => {
    const md = highlightsToMarkdown({ title: "A  Title", url: "https://x.test/a" }, [
      { exact: "First quote", note: "why it matters" },
      { exact: "Second\n\nquote", note: null },
    ]);
    expect(md).toBe(
      "# A Title\n\nSource: https://x.test/a\n\n> First quote\n\nNote: why it matters\n\n> Second\n> quote\n"
    );
  });

  it("handles no url and no highlights", () => {
    expect(highlightsToMarkdown({ title: "", url: null }, [])).toBe("# Untitled\n");
  });
});

describe("exportFileName", () => {
  it("slugs the title", () => {
    expect(exportFileName("Hello, World! ¿Qué?")).toBe("hello-world-que-highlights.md");
    expect(exportFileName("!!!")).toBe("article-highlights.md");
  });
});
