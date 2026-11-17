import { describe, expect, it } from "vitest";
import type { RepoDetails } from "@/db/schema";
import { repoLanguages, viewRepos, type RepoRowData } from "./repo-view";

const row = (id: string, repo: Partial<RepoDetails> | null): RepoRowData =>
  ({
    id,
    content: id,
    title: id,
    summary: null,
    repo: repo && { owner: "o", name: id, topics: "[]", description: null, language: null, stars: null, pushedAt: null, readmeExcerpt: null, ...repo },
  }) as unknown as RepoRowData;

const rows = [
  row("beta", { language: "Rust", stars: 5, pushedAt: new Date("2026-01-01"), topics: '["gui"]' }),
  row("alpha", { language: "Go", stars: 900, pushedAt: new Date("2026-03-01"), readmeExcerpt: "Fast terminal toolkit" }),
  row("gamma", { language: "Rust", stars: null }),
  row("nodata", null),
];
const ids = (r: RepoRowData[]) => r.map((x) => x.id);

describe("viewRepos", () => {
  it("keeps the incoming order by default", () => {
    expect(ids(viewRepos(rows, { query: "", language: "", sort: "default" }))).toEqual(["beta", "alpha", "gamma", "nodata"]);
  });
  it("sorts with missing values last", () => {
    expect(ids(viewRepos(rows, { query: "", language: "", sort: "stars" }))).toEqual(["alpha", "beta", "gamma", "nodata"]);
    expect(ids(viewRepos(rows, { query: "", language: "", sort: "updated" })).slice(0, 2)).toEqual(["alpha", "beta"]);
    expect(ids(viewRepos(rows, { query: "", language: "", sort: "name" }))[0]).toBe("nodata");
    expect(ids(viewRepos(rows, { query: "", language: "", sort: "language" })).slice(0, 3)).toEqual(["alpha", "beta", "gamma"]);
  });
  it("filters by text across name, topics and README, and by language", () => {
    expect(ids(viewRepos(rows, { query: "gui", language: "", sort: "default" }))).toEqual(["beta"]);
    expect(ids(viewRepos(rows, { query: "terminal toolkit", language: "", sort: "default" }))).toEqual(["alpha"]);
    expect(ids(viewRepos(rows, { query: "", language: "Rust", sort: "default" }))).toEqual(["beta", "gamma"]);
  });
  it("lists languages by frequency", () => {
    expect(repoLanguages(rows)).toEqual(["Rust", "Go"]);
  });
});
