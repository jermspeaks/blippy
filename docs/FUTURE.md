# Future phases

Phase 1 is implemented. These items are for later work (other agents or you).

## Phase 2: SRS and snooze

- Refine SRS algorithm: intervals, streak, configurable “blips per day” or max feed size.
- Snooze presets (e.g. +1 day, +1 week, custom).
- Optional per-category feed limits.

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
