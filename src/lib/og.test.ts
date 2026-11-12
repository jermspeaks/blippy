import { describe, it, expect } from "vitest";
import { parseMetadata } from "./og";

describe("parseMetadata", () => {
  it("reads og tags, decodes entities and resolves relative images", () => {
    const html = `<head><title>Fallback</title>
      <meta property="og:title" content="Tom &amp; Jerry">
      <meta content='A desc' property='og:description'>
      <meta property="og:image" content="/img/a.png">
      <meta property="og:site_name" content="Site"></head>`;
    expect(parseMetadata(html, "https://x.com/p/1")).toEqual({
      title: "Tom & Jerry",
      description: "A desc",
      imageUrl: "https://x.com/img/a.png",
      siteName: "Site",
    });
  });

  it("falls back to <title> and meta description", () => {
    const m = parseMetadata(
      `<title> Hello </title><meta name="description" content="d">`,
      "https://x.com"
    );
    expect(m.title).toBe("Hello");
    expect(m.description).toBe("d");
    expect(m.imageUrl).toBeNull();
  });
});
