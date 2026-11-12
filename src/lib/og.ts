import dns from "dns/promises";
import net from "net";

export type LinkMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

const EMPTY: LinkMetadata = {
  title: null,
  description: null,
  imageUrl: null,
  siteName: null,
};

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || v6.startsWith("fe80");
}

/** Reject non-http(s) URLs and hosts that resolve to private/loopback addresses. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("Blocked address");
  }
  return url;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim();
}

export function parseMetadata(html: string, baseUrl: string): LinkMetadata {
  const head = html.slice(0, MAX_BYTES);
  const meta = new Map<string, string>();
  for (const tag of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of tag[0].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? "";
    }
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v && decodeEntities(v)) return decodeEntities(v);
    }
    return null;
  };

  let imageUrl = pick("og:image", "og:image:url", "twitter:image");
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, baseUrl).toString();
    } catch {
      imageUrl = null;
    }
  }
  return {
    title:
      pick("og:title", "twitter:title") ??
      (titleTag ? decodeEntities(titleTag.replace(/\s+/g, " ")) || null : null),
    description: pick("og:description", "twitter:description", "description"),
    imageUrl,
    siteName: pick("og:site_name"),
  };
}

/** Fetch a page and return its Open Graph / Twitter card metadata. Never throws. */
export async function fetchLinkMetadata(rawUrl: string): Promise<LinkMetadata> {
  try {
    let current = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const url = await assertPublicUrl(current);
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; BlippyBot/1.0; link preview)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return EMPTY;
        current = new URL(loc, url).toString();
        continue;
      }
      if (!res.ok) return EMPTY;
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("html")) return EMPTY;

      // Read only the first chunk of the body; metadata lives in <head>.
      const reader = res.body?.getReader();
      if (!reader) return EMPTY;
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      reader.cancel().catch(() => {});
      const html = Buffer.concat(chunks).toString("utf8");
      return parseMetadata(html, url.toString());
    }
    return EMPTY;
  } catch {
    return EMPTY;
  }
}
