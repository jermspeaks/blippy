# Lifecycle pathways

- **Status:** Exploring (not designed)
- **Date started:** 2026-11-11
- **Related:** [../FUTURE.md](../FUTURE.md) (Phases 2 and 3), [spaces.md](spaces.md)

## Goal

Blips should be able to progress, or die out, along paths that depend on what they are, rather than a single FSRS-style resurfacing loop. Rough progression: **blip -> idea -> implementation -> review**, but destinations differ:

- **Knowledge:** fills a knowledge base. Done when filed and linked.
- **Recipe / reference:** logged in a recipe book (or similar) with structured fields.
- **Project seed:** helps start a new project; moves through idea -> implementation -> review.
- **Dies out:** fizzles by decision or neglect (e.g. repeatedly snoozed).

## Decisions

None yet. This doc records direction only. Spaces are a first step toward "somewhere for blips to go".

## Open questions

- Who picks the path: the user, the AI at import, or inferred from behavior?
- Fixed path templates or user-defined stages per kind?
- What are "implementation" and "review" for a non-project blip?
- Where do outputs live: inside Blippy or exported (e.g. Obsidian, see Phase 4)?
- How does FSRS fit: one stage's resurfacing engine rather than the whole lifecycle?
- How do topic groups and spaces relate to paths? Can a group be promoted to one idea or project?
- Automatic death: which signals (snooze count, age, no moves) should propose fizzling?

## Design

Not started. Likely touchpoints: a `kind`/`pathway` on blips, a stage history table (blip, stage, entered_at), and a way to attach outputs (notes, recipe entries, projects).

## Follow-ups

- [ ] Write down 3-5 real blips and trace the path each should take.
