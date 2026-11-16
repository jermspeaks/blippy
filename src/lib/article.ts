import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import sanitizeHtml from "sanitize-html";
import { fetchPageHtml, parseMetadata } from "@/lib/og";

const WORDS_PER_MINUTE = 230;
/** Fewer words than this means the page is probably a paywall, login wall or script-rendered. */
export const MIN_WORDS = 100;
const IFRAME_HOSTS = ["www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com"];

export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / WORDS_PER_MINUTE));

const upgrade = (src: string | undefined) => (src ? src.replace(/^http:\/\//i, "https://") : src);

/**
 * Reduce article HTML to a safe allowlist for the reader. No scripts, styles,
 * forms or event handlers; links open in a new tab; images are https only and
 * load without a referrer; iframes only for YouTube and Vimeo.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre", "code",
      "ul", "ol", "li", "dl", "dt", "dd", "em", "strong", "b", "i", "u", "s", "sub", "sup",
      "small", "mark", "a", "img", "figure", "figcaption", "picture", "source",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "div", "span", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "referrerpolicy"],
      iframe: ["src", "width", "height", "title", "allowfullscreen", "loading", "referrerpolicy"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      code: ["class"],
      pre: ["class"],
    },
    allowedClasses: { code: [/^language-[\w-]+$/], pre: [/^language-[\w-]+$/] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"], iframe: ["https"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: IFRAME_HOSTS,
    allowIframeRelativeUrls: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: upgrade(attribs.src) ?? "", loading: "lazy", referrerpolicy: "no-referrer" },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy", referrerpolicy: "no-referrer" },
      }),
    },
    // Drop images that lost their src (non-https) rather than leave an empty tag.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}

export type ParsedArticle = {
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  leadImageUrl: string | null;
  contentHtml: string;
  wordCount: number;
  readingMinutes: number;
};

export type ArticleResult = { ok: true; article: ParsedArticle } | { ok: false; reason: string };

/** Extract the readable article from a page's HTML (Readability, then sanitize). */
export function parseArticle(html: string, url: string): ArticleResult {
  // Silence jsdom's CSS/script warnings; scripts are never run (default).
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  const meta = parseMetadata(html, url);
  let parsed: ReturnType<Readability["parse"]>;
  try {
    parsed = new Readability(dom.window.document, { charThreshold: 300 }).parse();
  } catch {
    return { ok: false, reason: "Couldn't read this page." };
  } finally {
    dom.window.close();
  }
  if (!parsed?.content) {
    return { ok: false, reason: "Couldn't find an article on this page." };
  }
  const contentHtml = sanitizeArticleHtml(parsed.content);
  const text = parsed.textContent?.trim() ?? "";
  const wordCount = countWords(text);
  if (wordCount < MIN_WORDS) {
    return {
      ok: false,
      reason: "Too little text found. The page may be paywalled, behind a login, or built with JavaScript.",
    };
  }
  return {
    ok: true,
    article: {
      title: (parsed.title || meta.title || url).trim().slice(0, 300),
      byline: parsed.byline?.trim().slice(0, 200) || null,
      siteName: (parsed.siteName || meta.siteName)?.trim().slice(0, 100) || null,
      excerpt: (parsed.excerpt || text.slice(0, 280)).trim().slice(0, 500) || null,
      leadImageUrl: meta.imageUrl && /^https:\/\//.test(meta.imageUrl) ? meta.imageUrl : null,
      contentHtml,
      wordCount,
      readingMinutes: readingMinutes(wordCount),
    },
  };
}

/** Fetch a page and extract its article. Never throws; failures carry a reason for the user. */
export async function extractArticle(url: string): Promise<ArticleResult> {
  let page;
  try {
    page = await fetchPageHtml(url);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Couldn't reach the page." };
  }
  return parseArticle(page.html, page.url);
}
