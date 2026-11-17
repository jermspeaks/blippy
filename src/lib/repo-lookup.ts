import type { RepoRef } from "@/lib/repo";

export type RepoInfo = {
  description: string | null;
  stars: number | null;
  language: string | null;
  topics: string[];
  license: string | null;
  homepage: string | null;
  pushedAt: Date | null;
  archived: boolean;
};

export type RepoLookupDeps = { fetch?: typeof fetch; githubToken?: string | null };

/** Rate limit, server error or network failure: unknown, so retry later rather than record "no details". */
export class RepoLookupUnavailableError extends Error {
  constructor(detail: string) {
    super(`Repository lookup unavailable (${detail})`);
  }
}

const TIMEOUT_MS = 8000;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const date = (v: unknown) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const https = (v: unknown) => {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

type Json = Record<string, unknown>;

export function fromGithub(d: Json): RepoInfo {
  return {
    description: str(d.description),
    stars: num(d.stargazers_count),
    language: str(d.language),
    topics: Array.isArray(d.topics) ? d.topics.filter((t): t is string => typeof t === "string") : [],
    license: str((d.license as Json | null)?.spdx_id) ?? str((d.license as Json | null)?.name),
    homepage: https(d.homepage),
    pushedAt: date(d.pushed_at),
    archived: d.archived === true,
  };
}

export function fromGitlab(d: Json): RepoInfo {
  return {
    description: str(d.description),
    stars: num(d.star_count),
    language: null, // not in the project payload
    topics: Array.isArray(d.topics) ? d.topics.filter((t): t is string => typeof t === "string") : [],
    license: str((d.license as Json | null)?.name),
    homepage: null,
    pushedAt: date(d.last_activity_at),
    archived: d.archived === true,
  };
}

export function fromBitbucket(d: Json): RepoInfo {
  return {
    description: str(d.description),
    stars: null, // Bitbucket has no stars
    language: str(d.language),
    topics: [],
    license: null,
    homepage: https(d.website),
    pushedAt: date(d.updated_on),
    archived: false,
  };
}

export function fromGitea(d: Json): RepoInfo {
  return {
    description: str(d.description),
    stars: num(d.stars_count),
    language: str(d.language),
    topics: Array.isArray(d.topics) ? d.topics.filter((t): t is string => typeof t === "string") : [],
    license: null,
    homepage: https(d.website),
    pushedAt: date(d.updated_at),
    archived: d.archived === true,
  };
}

function endpoint(ref: RepoRef, token: string | null): { url: string; headers: Record<string, string>; map: (d: Json) => RepoInfo } | null {
  const o = encodeURIComponent(ref.owner);
  const n = encodeURIComponent(ref.name);
  switch (ref.provider) {
    case "github":
      return {
        url: `https://api.github.com/repos/${o}/${n}`,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        map: fromGithub,
      };
    case "gitlab":
      return {
        url: `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${ref.owner}/${ref.name}`)}`,
        headers: {},
        map: fromGitlab,
      };
    case "bitbucket":
      return { url: `https://api.bitbucket.org/2.0/repositories/${o}/${n}`, headers: {}, map: fromBitbucket };
    case "codeberg":
      return { url: `https://codeberg.org/api/v1/repos/${o}/${n}`, headers: {}, map: fromGitea };
    default:
      return null; // sourcehut: no public JSON API we rely on
  }
}

/**
 * Details for a repository from its host's public API (fixed hosts only; the
 * saved URL is never fetched). Null when the host has no API or the repo does
 * not exist (404). Throws RepoLookupUnavailableError on rate limits, server
 * errors and network failures so the caller can retry later.
 */
export async function lookupRepo(ref: RepoRef, deps: RepoLookupDeps = {}): Promise<RepoInfo | null> {
  const token = deps.githubToken === undefined ? process.env.GITHUB_TOKEN || null : deps.githubToken;
  const ep = endpoint(ref, token);
  if (!ep) return null;
  const f = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(ep.url, { headers: ep.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new RepoLookupUnavailableError(err instanceof Error ? err.message : "network");
  }
  if (res.status === 404 || res.status === 451) return null;
  if (!res.ok) throw new RepoLookupUnavailableError(`HTTP ${res.status}`);
  try {
    return ep.map((await res.json()) as Json);
  } catch {
    throw new RepoLookupUnavailableError("bad response");
  }
}

const README_MAX_CHARS = 20_000;
const EXCERPT_MAX = 300;

/**
 * First real paragraph of a README as plain text: skips headings, badges, images,
 * HTML, code, tables and lists of links; keeps link text. Null when none is found.
 */
export function readmeExcerpt(markdown: string): string | null {
  const cleaned = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "\n\n")
    .replace(/<[^>]+>/g, " ");
  for (const block of cleaned.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    // Headings, tables, rules, quotes, lists, setext underlines and indented code are not the intro.
    if (/^(#|\||>|[-*+]\s|\d+[.)]\s|={3,}|-{3,}|\[[^\]]+\]:\s)/.test(lines[0]) || /^( {4}|\t)/.test(block)) continue;
    const text = lines
      .join(" ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images and badges
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/(\*\*|__|\*|_|`)/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 30 || !/[a-z]{3}/i.test(text)) continue;
    if (text.length <= EXCERPT_MAX) return text;
    const cut = text.slice(0, EXCERPT_MAX);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), EXCERPT_MAX - 40)).trimEnd()}…`;
  }
  return null;
}

function readmeEndpoint(ref: RepoRef, token: string | null): { url: string; headers: Record<string, string> } | null {
  const o = encodeURIComponent(ref.owner);
  const n = encodeURIComponent(ref.name);
  switch (ref.provider) {
    case "github":
      return {
        url: `https://api.github.com/repos/${o}/${n}/readme`,
        headers: {
          Accept: "application/vnd.github.raw+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };
    case "gitlab":
      return {
        url: `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${ref.owner}/${ref.name}`)}/repository/files/README.md/raw?ref=HEAD`,
        headers: {},
      };
    case "bitbucket":
      return { url: `https://api.bitbucket.org/2.0/repositories/${o}/${n}/src/HEAD/README.md`, headers: {} };
    case "codeberg":
      return { url: `https://codeberg.org/api/v1/repos/${o}/${n}/raw/README.md`, headers: {} };
    default:
      return null;
  }
}

/**
 * Excerpt from the repository's README. "" when the repo has no usable README
 * (or the host has no API); throws RepoLookupUnavailableError on rate limits,
 * server errors and network failures so the caller can retry later.
 */
export async function lookupReadmeExcerpt(ref: RepoRef, deps: RepoLookupDeps = {}): Promise<string> {
  const token = deps.githubToken === undefined ? process.env.GITHUB_TOKEN || null : deps.githubToken;
  const ep = readmeEndpoint(ref, token);
  if (!ep) return "";
  const f = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await f(ep.url, { headers: ep.headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new RepoLookupUnavailableError(err instanceof Error ? err.message : "network");
  }
  if (res.status === 404 || res.status === 451) return "";
  if (!res.ok) throw new RepoLookupUnavailableError(`HTTP ${res.status}`);
  try {
    return readmeExcerpt((await res.text()).slice(0, README_MAX_CHARS)) ?? "";
  } catch {
    throw new RepoLookupUnavailableError("bad response");
  }
}
