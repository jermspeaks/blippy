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
