import { describe, it, expect } from "vitest";
import { parseArticle, sanitizeArticleHtml, countWords, readingMinutes } from "./article";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const page = (body: string, head = "") =>
  `<!doctype html><html><head><title>Site | Post</title>${head}</head><body>${body}</body></html>`;

describe("sanitizeArticleHtml", () => {
  it("removes scripts, handlers, styles and unsafe links, keeps article markup", () => {
    const out = sanitizeArticleHtml(
      `<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://e.com/a">ok</a></p>` +
        `<script>alert(1)</script><style>p{}</style><form><input></form><h2>Head</h2><blockquote>q</blockquote>`
    );
    expect(out).not.toMatch(/script|onclick|javascript:|<style|<form|<input/i);
    expect(out).toContain('<a href="https://e.com/a" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(out).toContain("<h2>Head</h2>");
    expect(out).toContain("<blockquote>q</blockquote>");
  });

  it("allows only https images (upgrading http), lazy and without referrer", () => {
    const out = sanitizeArticleHtml(
      `<img src="http://e.com/a.jpg" alt="a"><img src="data:image/png;base64,AAAA"><img src="javascript:x">`
    );
    expect(out).toContain('src="https://e.com/a.jpg"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('referrerpolicy="no-referrer"');
    expect(out.match(/<img/g)).toHaveLength(1);
  });

  it("keeps YouTube/Vimeo iframes and drops others", () => {
    const out = sanitizeArticleHtml(
      `<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe><iframe src="https://evil.example/x"></iframe>`
    );
    expect(out).toContain("youtube-nocookie.com/embed/abc");
    expect(out).not.toContain("evil.example");
  });
});

describe("parseArticle", () => {
  it("extracts title, byline, content and reading time, resolving relative URLs", () => {
    const html = page(
      `<nav>Home About Subscribe</nav><article><h1>Real Title</h1><p class="byline">By Jane Roe</p>` +
        `<p>${words(300)}</p><p><img src="/img/a.jpg" alt="a"> <a href="/more">more</a></p><p>${words(300)}</p></article>` +
        `<footer>Subscribe now! Ads ads ads</footer>`,
      `<meta property="og:image" content="https://cdn.example.com/lead.jpg"><meta property="og:site_name" content="Example Blog">`
    );
    const r = parseArticle(html, "https://example.com/posts/1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.title).toBeTruthy();
    expect(r.article.siteName).toBe("Example Blog");
    expect(r.article.leadImageUrl).toBe("https://cdn.example.com/lead.jpg");
    expect(r.article.wordCount).toBeGreaterThan(550);
    expect(r.article.readingMinutes).toBe(readingMinutes(r.article.wordCount));
    expect(r.article.contentHtml).toContain('src="https://example.com/img/a.jpg"');
    expect(r.article.contentHtml).toContain('href="https://example.com/more"');
    expect(r.article.contentHtml).not.toMatch(/Ads ads ads|<script/);
  });

  it("fails with a reason for pages with too little text", () => {
    const r = parseArticle(page(`<article><p>${words(40)}</p></article>`), "https://example.com/x");
    expect(r.ok).toBe(false);
  });

  it("counts words and rounds reading time up to at least a minute", () => {
    expect(countWords("a  b\nc")).toBe(3);
    expect(readingMinutes(10)).toBe(1);
    expect(readingMinutes(2300)).toBe(10);
  });
});
