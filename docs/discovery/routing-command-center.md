# Routing command center

- **Status:** In progress (step 1 built; rest designed)
- **Date started:** 2026-11-14
- **Related:** [inbox-routing.md](inbox-routing.md), [spaces.md](spaces.md), [../FUTURE.md](../FUTURE.md) (Exploratory), `src/lib/routing.ts`, `src/lib/ai/prompt.ts`

## Goal

One place to see and control how links automatically get filtered: which rules exist, what instructions the AI uses to decide where a link belongs, and how well routing is performing. Today routing is spread across code (video rule), group links, and a built-in prompt, so the user can't see why a link went where it did.

## Decisions

- **Per-space "let the AI route here" switch (first deliverable):** a `spaces.ai_routing` boolean (default true). Separate from auto-intake, so a space can still receive linked-group routing but opt out of AI matches. `aiEligibleSpaces` in `capture.ts` filters on it. Chosen because AI routing is automatic and needs its own off switch.
- **Routing instructions are global, not per space:** capture is a single ingestion point, so one instruction block governs routing. A space's name and description are its only per-space signal. This replaces the earlier per-space `routing_hint` idea.
- **Store the AI's reason for each routing decision** (`blips.routed_reason`) so the user can monitor routing across blips and spot misroutes.
- **Command center is read-first:** a page that explains routing before it lets you edit it.

## Open questions

- Should rules be user-editable beyond kind (e.g. "domain github.com -> Dev Tools")? A deterministic domain rule list would be cheaper and more predictable than AI.
- Reason format: one short sentence from the AI, capped (e.g. 200 chars), only for AI-routed blips; rule/group routes get a fixed reason string.

## Design (phased)

1. **Per-space AI-routing switch (built):** `spaces.ai_routing` (migration 0005), checkbox in the space Settings dialog (general spaces only), "AI routing" column on the spaces table, `aiEligibleSpaces` (in `src/lib/routing.ts`) honors it alongside auto-intake. Tests in `routing.test.ts` and `spaces.test.ts`.
2. **Routing page (`/routing`):** lists the routing order (rule -> linked group -> AI), the active rules (video), each space with its linked groups, auto-intake and AI-routing state, and the current AI instructions (built-in prompt + Settings additions, read-only).
3. **Routing reason:** the AI returns a short `reason` with each `space` pick; store it in `blips.routed_reason` (rule/group routes store a fixed reason); show it on hover/inline in space views.
3b. **Global routing instructions:** an editable block (Settings or `/routing`) appended to the routing part of the prompt; the page shows the built-in prompt read-only above it.
4. **Domain rules:** `routing_rules` table (`pattern`, `space_id`), evaluated before group/AI in `pickRoute`; editable on the page.
5. **Routing history:** recent captures with where each went, `routed_by` and `routed_reason`, to spot misroutes (builds on the [capture result panel](capture-result-panel.md)).

## Out of scope / later

- Learning rules automatically from manual corrections (beyond the existing "link this group" prompt).

## Follow-ups

- [x] Step 1: AI-routing switch.
- [ ] Step 3: routing reason (next).
