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

Status: idea stage. The shape is deliberately open; this section records the direction and the questions to answer before building. It may reshape Phase 2 (SRS) and Phase 3 (maturity), since a single spaced-repetition (FSRS) loop is not enough on its own.

**Core idea:** a blip should be able to progress, or die out, along a path that depends on what it is. The rough progression is **blip -> idea -> implementation -> review**, but the destination and the steps differ by kind of blip:

- **Knowledge:** feeds a knowledge base (notes, summaries, linked concepts). Done when it is filed and linked.
- **Recipe / reference:** gets logged in a recipe book (or similar collection) with structured fields. Done when it is recorded.
- **Project seed:** ultimately helps start a new project. Moves through idea -> implementation -> review.
- **Dies out:** fizzles by decision or by neglect (e.g. repeatedly snoozed, never touched).

**Open questions**

- Is the path chosen by the user, suggested by the AI at import time, or inferred from behavior?
- Are paths a fixed set of templates, or user-defined stages per kind?
- What is "implementation" and "review" for a non-project blip? Does each kind have its own review?
- Where do outputs live: inside Blippy (collections/recipe book/KB), or exported (e.g. Obsidian, see Phase 4)?
- How does FSRS fit? Possibly as one stage's resurfacing engine rather than the whole lifecycle.
- How do blip groups (topic clusters from import) relate to paths? Can a group be promoted to one idea or project?
- Automatic death: what signals (snooze count, age, no moves) should propose fizzling?

**Likely data model touchpoints** (to validate): a `kind`/`pathway` on blips, stage history (blip, stage, entered_at), and a way to attach outputs (notes, recipe entries, projects).

## Phase 4: Auth and sync (Swift)

- Authentication (e.g. NextAuth or similar) so data is per-user.
- Stable REST/JSON API for a Swift app: create/update blips, get feed, snooze. Same metadata for export (e.g. Obsidian).
- Swift app: capture and optional feed, server as source of truth.

## Phase 5: Workflows and agents

- Predefined workflows (e.g. “book recommendation” → collection; “AT protocol” → key questions + summary).
- Agents only where “what next” is defined; human-in-the-loop for blip cultivation.
