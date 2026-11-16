# Future phases

## Next up (ranked)

Tier 1 is done (routing command center, domain rules, snoozed view, categories removed). Planned next, in order:

**Tier 2: next features**

1. **Snooze presets:** +1 day, +1 week, custom date (today only +1 day). Pairs with the snoozed list.
2. ~~**GitHub specialized space**~~ built as the **code space** (stars, topics, language, description; [discovery/code-space.md](discovery/code-space.md)); README excerpt is a follow-up.
3. **Feed size cap:** configurable blips per day / max feed size (today a fixed 50).

**Tier 3: needs design first**

4. Groups management page (`/groups`), after the routing log shows how much cleanup is needed.
5. Moves and maturity, plus [lifecycle pathways](discovery/lifecycle-pathways.md).

**Tier 4: deferred:** auth + Swift/REST API (Phase 4), workflows and agents (Phase 5).

**Ideas not yet scheduled:** undo / "wrong space?" re-route on a blip (and log manual corrections as routing events), feed keyboard shortcuts, bulk actions, global search, duplicate detection on capture (normalized URL), dead-link checks, weekly digest, browser extension or bookmarklet capture, one-way Obsidian export, stats strip.

Phase 1 is implemented. These items are for later work (other agents or you).

## Phase 2: SRS and snooze

- Refine SRS algorithm: intervals, streak, configurable “blips per day” or max feed size.
- Snooze presets (e.g. +1 day, +1 week, custom).
- Optional per-space feed limits (categories were removed).

## Phase 3: Moves and maturity

- **Moves:** Scaffolded microtasks (e.g. “talk 2 min”, “add link”, “choose one”) when a blip is in the feed; log completion.
- **Maturity / status:** Clear flow from captured → cultivating → project / matured or fizzled; UI and feed respect status.

## Exploratory: Lifecycle pathways (not yet designed)

Blips should be able to progress, or die out, along paths that depend on what they are (knowledge base, recipe book, project seed), not just one FSRS loop. May reshape Phases 2 and 3. Details and open questions: [discovery/lifecycle-pathways.md](discovery/lifecycle-pathways.md).

## Phase 4: Auth and sync (Swift)

- Authentication (e.g. NextAuth or similar) so data is per-user.
- Stable REST/JSON API for a Swift app: create/update blips, get feed, snooze. Same metadata for export (e.g. Obsidian).
- Swift app: capture and optional feed, server as source of truth.

## Phase 5: Workflows and agents

- Predefined workflows (e.g. “book recommendation” → collection; “AT protocol” → key questions + summary).
- Agents only where “what next” is defined; human-in-the-loop for blip cultivation.

## Exploratory

### Routing command center (mostly done)

Built: `/routing` page with routing order, domain rules, per-space state, AI prompt and audit log. Open: log manual corrections as events and show the log in the capture result panel. See [plan](discovery/routing-command-center.md).

### Spaces with multiple topics

Looks like there are aliases or other, very closely related topics, that can be grouped in the same space. That would be really good to add to routing command.

### Specialized spaces

**Books** are built (Pinterest-style cards: cover, title, author; see [discovery/book-space.md](discovery/book-space.md)); price is a stretch goal. **Code** repositories are built too (GitHub, GitLab, Bitbucket, Codeberg; [discovery/code-space.md](discovery/code-space.md)).

Books: Pinterest style (so make sure we can fetch the book details). Add book metadata like author, genre, summary.

### AI spaces summary

Have the AI generate a summary of each space, so users can quickly see what topics are covered.

### Expandable side nav for spaces

Have the nested space navigation expandable, so users can see all the spaces and their topics.

### Read Later Feature

Some of the articles here are really for read later. They may belong to a space, but essentially I want a reading page where it is distraction-free reading - just the text, images, and media (no ads, no fluff). 

**Phases 1-2 built** (separate from spaces; stored article text; status, scroll position, display settings, highlights; added from feed/spaces or by URL): see [discovery/reading-list.md](discovery/reading-list.md).

### Changlog feature

Add a page on the website (w/in settings probably) to show the changelog.

### Decisions API

I want to utilize the new decisions API to automate the routing of blips to the appropriate spaces. Let's figure out how to integrate it. Domain rules now cover the deterministic cases, so this only needs to handle what rules miss.

### View snoozed blips (done)

Snoozed blips are listed at `/spaces/snoozed` (linked from Spaces) with an Unsnooze action. Next: snooze presets (+1 week, custom).

### Removing categories (done)

Categories were removed (UI, actions, schema; migration 0007).

### Groups management page (`/groups`)

Topic groups are currently only triaged from the feed (create a space, move to a space). A dedicated page could add: rename, merge two groups, link/unlink a space, delete, and move a blip between groups. Not designed yet; revisit once the routing command center ([plan](discovery/routing-command-center.md)) shows how much group cleanup is actually needed.
