import { describe, it, expect, vi } from "vitest";
import { lookupRepo, lookupReadmeExcerpt, readmeExcerpt, RepoLookupUnavailableError, fromGithub, fromGitlab } from "./repo-lookup";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const gh = { provider: "github", owner: "iced-rs", name: "iced" } as const;

describe("repo lookup", () => {
  it("maps a GitHub repo", async () => {
    const f = vi.fn(async () =>
      json({
        description: "A GUI library",
        stargazers_count: 24000,
        language: "Rust",
        topics: ["gui", "rust"],
        license: { spdx_id: "MIT" },
        homepage: "https://iced.rs",
        pushed_at: "2026-01-02T00:00:00Z",
        archived: false,
      })
    ) as unknown as typeof fetch;
    const info = await lookupRepo(gh, { fetch: f, githubToken: "t" });
    expect(info).toMatchObject({ description: "A GUI library", stars: 24000, language: "Rust", topics: ["gui", "rust"], license: "MIT", homepage: "https://iced.rs" });
    expect(info?.pushedAt?.getUTCFullYear()).toBe(2026);
    const [url, init] = vi.mocked(f).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/iced-rs/iced");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
  });

  it("sends no auth header without a token and drops non-http homepages", () => {
    expect(fromGithub({ homepage: "javascript:alert(1)" }).homepage).toBeNull();
  });

  it("returns null for a missing repo and for a host without an API", async () => {
    const f = vi.fn(async () => json({}, 404)) as unknown as typeof fetch;
    expect(await lookupRepo(gh, { fetch: f, githubToken: null })).toBeNull();
    const none = vi.fn() as unknown as typeof fetch;
    expect(await lookupRepo({ provider: "sourcehut", owner: "~a", name: "b" }, { fetch: none })).toBeNull();
    expect(none).not.toHaveBeenCalled();
  });

  it("throws (retry later) on rate limits, server errors and network failures", async () => {
    for (const status of [403, 429, 500]) {
      const f = vi.fn(async () => json({}, status)) as unknown as typeof fetch;
      await expect(lookupRepo(gh, { fetch: f, githubToken: null })).rejects.toBeInstanceOf(RepoLookupUnavailableError);
    }
    const down = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(lookupRepo(gh, { fetch: down, githubToken: null })).rejects.toBeInstanceOf(RepoLookupUnavailableError);
  });

  it("encodes the GitLab project path", async () => {
    const f = vi.fn(async () => json({ description: "d", star_count: 5, topics: ["x"] })) as unknown as typeof fetch;
    const info = await lookupRepo({ provider: "gitlab", owner: "gitlab-org", name: "gitlab" }, { fetch: f });
    expect(vi.mocked(f).mock.calls[0][0]).toBe("https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab");
    expect(info).toMatchObject({ stars: 5, topics: ["x"] });
    expect(fromGitlab({}).topics).toEqual([]);
  });
});

describe("README excerpt", () => {
  it("skips title, badges, html and code to the first paragraph", () => {
    const md = `<h1 align="center">iced</h1>\n\n[![CI](https://img.shields.io/x.svg)](https://ci)\n![logo](logo.png)\n\n# iced\n\n\`\`\`rust\nlet x = 1;\n\`\`\`\n\nA **cross-platform** GUI library for [Rust](https://rust-lang.org) focused on simplicity.\nSee more below.\n\n## Install`;
    expect(readmeExcerpt(md)).toBe(
      "A cross-platform GUI library for Rust focused on simplicity. See more below."
    );
  });

  it("truncates long paragraphs on a word and returns null when there is no prose", () => {
    const long = "word ".repeat(200);
    const out = readmeExcerpt(long)!;
    expect(out.length).toBeLessThanOrEqual(301);
    expect(out.endsWith("…")).toBe(true);
    expect(readmeExcerpt("# Title\n\n- a\n- b\n\n| a | b |")).toBeNull();
  });

  it("fetches per host, treats 404 as none and errors as unavailable", async () => {
    const f = vi.fn(async () => new Response("# T\n\nA small library that does one thing well.")) as unknown as typeof fetch;
    expect(await lookupReadmeExcerpt(gh, { fetch: f, githubToken: null })).toBe("A small library that does one thing well.");
    expect((vi.mocked(f).mock.calls[0] as unknown as [string])[0]).toBe("https://api.github.com/repos/iced-rs/iced/readme");
    expect(await lookupReadmeExcerpt(gh, { fetch: (async () => new Response("", { status: 404 })) as unknown as typeof fetch })).toBe("");
    await expect(
      lookupReadmeExcerpt(gh, { fetch: (async () => new Response("", { status: 429 })) as unknown as typeof fetch })
    ).rejects.toBeInstanceOf(RepoLookupUnavailableError);
    expect(await lookupReadmeExcerpt({ provider: "sourcehut", owner: "o", name: "n" })).toBe("");
  });
});
