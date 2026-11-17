# Future phases

Completed work is recorded in [CHANGELOG.md](CHANGELOG.md).

## Next up

**Needs design first**

1. **Groups management page (`/groups`).** Topic groups are only triaged from the feed today. A page could add rename, merge, link/unlink a space, delete, and move a blip between groups. Revisit once the routing log shows how much cleanup is needed. See [routing plan](discovery/routing-command-center.md).
2. **Moves and maturity**, plus [lifecycle pathways](discovery/lifecycle-pathways.md):
   - *Moves:* scaffolded microtasks (e.g. "talk 2 min", "add link", "choose one") when a blip is in the feed; log completion.
   - *Maturity:* clear flow from captured to cultivating to project / matured or fizzled; UI and feed respect status.
   - Blips should progress, or die out, along paths that depend on what they are (knowledge base, recipe book, project seed), not one FSRS loop.
3. **Decisions API for routing.** Use the new Decisions API to route blips that domain rules miss. Needs an integration design.

## Follow-ups to shipped features

- **Routing:** log manual corrections as routing events and show the log in the capture result panel. Support spaces with multiple topics or aliases.
- **Books:** author check for ISBN-less URLs (e.g. HarperCollins product pages can match the wrong book); genre and price as stretch goals.
- **Code space:** README excerpt, sort/filter, scheduled refresh.
- **Reading list:** copy/export highlights (markdown), local image caching.
- **Feed:** per-day quota; optional per-space feed limits; refine the SRS algorithm (intervals, streak).

## Ideas not yet scheduled

- Undo / "wrong space?" re-route on a blip.
- Feed keyboard shortcuts, bulk actions, global search.
- Duplicate detection on capture (normalized URL), dead-link checks.
- Weekly digest, stats strip.
- Browser extension or bookmarklet capture.
- One-way Obsidian export.
- AI summary of each space.
- Expandable side nav showing spaces and their topics.
- In-app changelog page (in Settings) rendering [CHANGELOG.md](CHANGELOG.md).

## Later phases

**Auth and sync (Swift)**
- Authentication (e.g. NextAuth) so data is per-user.
- Stable REST/JSON API for a Swift app: create/update blips, get feed, snooze. Same metadata for export (e.g. Obsidian).
- Swift app: capture and optional feed, server as source of truth.

**Workflows and agents**
- Predefined workflows (e.g. "book recommendation" to collection; "AT protocol" to key questions + summary).
- Agents only where "what next" is defined; human-in-the-loop for blip cultivation.
