import { describe, it, expect } from "vitest";
import { parseRepoUrl } from "./repo";

describe("parseRepoUrl", () => {
  it("recognizes repo roots on each host", () => {
    expect(parseRepoUrl("https://github.com/iced-rs/iced")).toEqual({ provider: "github", owner: "iced-rs", name: "iced" });
    expect(parseRepoUrl("https://www.github.com/vercel/next.js/")).toEqual({ provider: "github", owner: "vercel", name: "next.js" });
    expect(parseRepoUrl("https://github.com/o/r.git")).toMatchObject({ name: "r" });
    expect(parseRepoUrl("https://gitlab.com/gitlab-org/gitlab")).toMatchObject({ provider: "gitlab" });
    expect(parseRepoUrl("https://bitbucket.org/atlassian/aui")).toMatchObject({ provider: "bitbucket" });
    expect(parseRepoUrl("https://codeberg.org/forgejo/forgejo")).toMatchObject({ provider: "codeberg" });
    expect(parseRepoUrl("https://git.sr.ht/~sircmpwn/hare")).toMatchObject({ provider: "sourcehut", owner: "~sircmpwn" });
  });

  it("ignores pages inside a repo, profiles, site pages and other hosts", () => {
    for (const u of [
      "https://github.com/ggml-org/llama.cpp/blob/master/tools/x.py",
      "https://github.com/o/r/issues/1",
      "https://github.com/o/r/pull/2",
      "https://github.com/someuser",
      "https://github.com/features/copilot",
      "https://github.com/orgs/acme/projects",
      "https://github.com/topics/rust",
      "https://gist.github.com/o/abc",
      "https://gitlab.com/group/sub/project", // could be a group page
      "https://gitlab.com/explore/projects",
      "https://git.sr.ht/o/r", // sourcehut owners start with ~
      "https://example.com/o/r",
      "ftp://github.com/o/r",
      "not a url",
    ]) {
      expect(parseRepoUrl(u), u).toBeNull();
    }
  });
});
