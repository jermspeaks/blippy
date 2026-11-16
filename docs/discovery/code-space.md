# Code space

- **Status:** Built (v1); README excerpt and manual edit are follow-ups
- **Date started:** 2026-11-15
- **Related:** [book-space.md](book-space.md) and [video-space.md](video-space.md) (pattern followed), [inbox-routing.md](inbox-routing.md), [spaces.md](spaces.md), `src/lib/repo.ts`, `src/lib/repo-lookup.ts`, `src/lib/repo-hydrate.ts`, `src/lib/code-space.ts`, `src/components/repo-table.tsx`, `src/actions/repos.ts`, `drizzle/0010_repo_details.sql`, [../FUTURE.md](../FUTURE.md)

## Goal

A **code** space shows saved code repositories as cards that answer "why did I save this?": **owner/repo, description, language, stars, topics, license, last update** (and an Archived flag). Example: save `github.com/iced-rs/iced` and a card shows "Rust", the star count, its topics and the one-line description.

## Decisions

- **`spaces.kind = "code"`**, same mechanism as video and book. A general space can be **converted** (Settings -> "Convert to code space", one-way, one code space). If no code space exists when a repo link arrives, a general space named "Programming Projects", "Code", "GitHub", "Repos" or "Repositories" is **adopted** (converted) rather than creating a duplicate; otherwise "Code" is created.
- **What counts as code: repository roots only** (`host/owner/repo`, nothing deeper) on **GitHub, GitLab, Bitbucket (bitbucket.org), Codeberg and SourceHut (`git.sr.ht/~owner/repo`)**. File, issue, PR, gist, profile and site pages (`/features`, `/topics`, `/orgs`...) do not match, since the metadata describes a repository, not a page in it. GitLab projects inside subgroups (3+ segments) are not recognized because a group page looks the same. Other forges are a later addition to `parseRepoUrl`.
- **Topic spaces win.** A repo link goes to the code space only when no linked topic group and no AI-matched space applies ("Code repository link", logged as `routed_by = rule`). Order: domain rule > video > book > topic group > AI > **code** > feed. Repo links already in a space are never pulled out; the sweep (on conversion, creation or turning auto-intake on) only takes unstored feed blips. In re-route, repo links are asked of the AI first and fall to the code space only if it finds nothing.
- **Metadata from each host's public API** (fixed hosts only; saved URLs are never fetched): GitHub `api.github.com/repos/o/r` (description, stars, language, topics, license, homepage, pushed_at, archived), GitLab `/api/v4/projects/:path` (no language), Bitbucket `api.bitbucket.org/2.0/repositories/o/r` (no stars or topics), Codeberg (Gitea) `/api/v1/repos/o/r`. SourceHut has no API we rely on, so those cards show only the saved title and link. **`GITHUB_TOKEN`** (optional, in `.env.local`, no scopes needed) lifts GitHub's limit from 60 to 5000 requests/hour.
- **One lookup path ("hydration"):** after a blip lands in a code space (capture, reprocess, re-route, manual store, group move, space creation/conversion/sweep), `hydratePendingRepos` fills blips with no `repo_details` row (25 per call; "Look up N more" does 50). A lookup never fails the operation.
- **Rate limits and errors are not failures:** 403/429/5xx/network errors are `deferred` (nothing recorded, retried by the next hydration or the card's refresh). A 404 or an API-less host is recorded as `failed` ("No repository details found"). A failed refresh keeps earlier good details.
- **Blip fields stay yours:** the title, image and link are untouched; the summary is filled from the repo description only if empty. Details live in `repo_details` (1:1, cascade).
- **Table (not cards):** one dense row per repo: name (links out) + description, language, stars, topics (first 4), license (wide screens), last update, and refresh / return to feed / fizzle. Non-repo blips in the space render as a row without details.

## Open questions

- README excerpt or "why saved" note on the card (a second API call per repo; `blips.summary` and the description cover most of it for now).
- Sort by stars / last update; filter by language or topic.
- Refresh stale details on a schedule (stars and activity change); today only on demand.
- Hugging Face, npm, PyPI and crates.io pages (packages, not repos) are not included.

## Follow-ups

- [x] Code kind, `parseRepoUrl`, routing fallback, adoption/conversion.
- [x] Per-host lookup and `repo_details`.
- [x] Repo table (first built as a card grid, then condensed to a table).
- [ ] README excerpt; manual edit of a card; sort/filter; scheduled refresh.
