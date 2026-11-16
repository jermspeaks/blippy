export type RepoProvider = "github" | "gitlab" | "bitbucket" | "codeberg" | "sourcehut";

export type RepoRef = { provider: RepoProvider; owner: string; name: string };

// First path segments that are site pages, not owners.
const RESERVED: Record<RepoProvider, Set<string>> = {
  github: new Set(
    "about apps collections contact customer-stories enterprise events explore features gist issues login marketplace new notifications orgs pricing pulls readme search security settings sponsors topics trending users".split(
      " "
    )
  ),
  gitlab: new Set("explore users groups help dashboard admin api projects snippets search".split(" ")),
  bitbucket: new Set("account dashboard product repo workspace blog support site".split(" ")),
  codeberg: new Set("explore user issues pulls org repo admin notifications attachments".split(" ")),
  sourcehut: new Set(),
};

const HOSTS: Record<string, RepoProvider> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
  "codeberg.org": "codeberg",
  "git.sr.ht": "sourcehut",
};

const SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * Recognize a code repository's own page: `host/owner/repo` and nothing deeper.
 * File, issue, PR, gist and profile pages return null, since repo details
 * describe a repository, not a page inside one. GitLab subgroup projects
 * (three or more segments) are not recognized because a group page looks the same.
 */
export function parseRepoUrl(raw: string | null | undefined): RepoRef | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const provider = HOSTS[host];
  if (!provider) return null;

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, rawName] = parts;
  const name = rawName.replace(/\.git$/, "");
  if (!SEGMENT.test(owner) || !SEGMENT.test(name) || !name) return null;
  if (RESERVED[provider].has(owner.toLowerCase())) return null;
  if (provider === "sourcehut" && !owner.startsWith("~")) return null;
  return { provider, owner, name };
}

export const isRepoUrl = (url: string | null | undefined) => parseRepoUrl(url) !== null;
