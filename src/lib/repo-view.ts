import type { Blip, RepoDetails } from "@/db/schema";

export type RepoRowData = Blip & { repo: RepoDetails | null };
export const repoSorts = ["default", "name", "stars", "updated", "language"] as const;
export type RepoSort = (typeof repoSorts)[number];

export const repoName = (b: RepoRowData) =>
  b.repo ? `${b.repo.owner}/${b.repo.name}` : (b.title ?? b.content.slice(0, 120));

export function parseTopics(raw: string | undefined): string[] {
  try {
    const a = JSON.parse(raw ?? "[]");
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Languages present in the list, most common first. */
export function repoLanguages(rows: RepoRowData[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (r.repo?.language) counts.set(r.repo.language, (counts.get(r.repo.language) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
}

const haystack = (b: RepoRowData) =>
  [repoName(b), b.repo?.description, b.summary, b.repo?.readmeExcerpt, b.repo?.language, ...parseTopics(b.repo?.topics)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

/** Filter by text (every word must match name, description, README intro, language or topics) and language, then sort. Rows missing the sort field go last. */
export function viewRepos(
  rows: RepoRowData[],
  opts: { query: string; language: string; sort: RepoSort }
): RepoRowData[] {
  const words = opts.query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = rows.filter(
    (b) =>
      (!opts.language || b.repo?.language === opts.language) &&
      words.every((w) => haystack(b).includes(w))
  );
  const num = (v: number | Date | null | undefined) => (v == null ? null : +v);
  const desc = (f: (b: RepoRowData) => number | null) => (a: RepoRowData, b: RepoRowData) => {
    const x = f(a);
    const y = f(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return y - x;
  };
  switch (opts.sort) {
    case "name":
      return out.sort((a, b) => repoName(a).localeCompare(repoName(b), undefined, { sensitivity: "base" }));
    case "stars":
      return out.sort(desc((b) => num(b.repo?.stars)));
    case "updated":
      return out.sort(desc((b) => num(b.repo?.pushedAt)));
    case "language":
      return out.sort((a, b) => {
        const x = a.repo?.language;
        const y = b.repo?.language;
        if (!x || !y) return x === y ? 0 : !x ? 1 : -1;
        return x.localeCompare(y);
      });
    default:
      return out;
  }
}
