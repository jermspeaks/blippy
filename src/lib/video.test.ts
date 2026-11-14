import { describe, it, expect } from "vitest";
import { parseVideoUrl } from "./video";

describe("parseVideoUrl", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${id}&t=10`,
    `https://youtu.be/${id}?si=x`,
    `https://m.youtube.com/shorts/${id}?ra=m`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ])("recognizes %s", (url) => {
    const v = parseVideoUrl(url);
    expect(v?.id).toBe(id);
    expect(v?.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    expect(v?.embedUrl).toContain(`youtube-nocookie.com/embed/${id}`);
  });
  it.each([
    "https://www.youtube.com/@channel",
    "https://www.youtube.com/watch?v=short",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "",
    null,
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url as string | null)).toBeNull();
  });
});
