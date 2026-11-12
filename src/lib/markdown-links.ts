export type ExtractedLink = {
  url: string;
  /** Link text from the markdown (or the line's text for bare/malformed links). */
  text: string;
  /** True when the line is an indented/bulleted child of an earlier line. */
  nested: boolean;
};

// Allows one level of balanced parentheses inside the URL, e.g. "...(z-lib.org).pdf".
const MD_LINK = /\[([^\]]*)\]\((https?:\/\/(?:[^()\s]|\([^()\s]*\))+)\)/g;
const BARE_URL = /https?:\/\/[^\s)\]>]+/g;

function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

/**
 * Pull links out of markdown notes. Deterministic on purpose: the AI never
 * decides which URLs exist, only how they are described and grouped.
 */
export function extractLinks(markdown: string): ExtractedLink[] {
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const nested = /^\s+[-*+]\s/.test(line) || /^[-*+]\s/.test(line);
    let rest = line;

    for (const m of line.matchAll(MD_LINK)) {
      const url = cleanUrl(m[2]);
      rest = rest.replace(m[0], " ");
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, text: m[1].trim(), nested });
    }

    // Bare URLs, or malformed links such as `Title](https://...)` with no "[".
    for (const m of rest.matchAll(BARE_URL)) {
      const url = cleanUrl(m[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      const text = rest
        .replace(m[0], " ")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/[\[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      out.push({ url, text, nested });
    }
  }
  return out;
}
