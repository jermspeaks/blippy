export type VideoInfo = {
  provider: "youtube";
  id: string;
  thumbnailUrl: string;
  embedUrl: string;
  watchUrl: string;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function youtube(id: string): VideoInfo | null {
  if (!YT_ID.test(id)) return null;
  return {
    provider: "youtube",
    id,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

/**
 * Recognize a video link and derive its thumbnail/embed URLs, or null if the
 * URL is not a supported video. Add a branch per provider (Vimeo, ...) here.
 */
export function parseVideoUrl(raw: string | null | undefined): VideoInfo | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();

  if (host === "youtu.be") return youtube(u.pathname.split("/")[1] ?? "");
  if (YT_HOSTS.has(host)) {
    if (u.pathname === "/watch") return youtube(u.searchParams.get("v") ?? "");
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    if (m) return youtube(m[1]);
  }
  return null;
}

export const isVideoUrl = (url: string | null | undefined) => parseVideoUrl(url) !== null;
