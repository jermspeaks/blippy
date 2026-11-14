# Routing command center

- **Status:** Designed (plan, not built)
- **Date started:** 2026-11-14
- **Related:** [inbox-routing.md](inbox-routing.md), [spaces.md](spaces.md), [../FUTURE.md](../FUTURE.md) (Exploratory), `src/lib/routing.ts`, `src/lib/ai/prompt.ts`

## Goal

One place to see and control how links automatically get filtered: which rules exist, what instructions the AI uses to decide where a link belongs, and how well routing is performing. Today routing is spread across code (video rule), group links, and a built-in prompt, so the user can't see why a link went where it did.

## Decisions

- **Per-space "let the AI route here" switch (first deliverable):** a `spaces.ai_routing` boolean (default true). Separate from auto-intake, so a space can still receive linked-group routing but opt out of AI matches. `aiEligibleSpaces` in `capture.ts` filters on it. Chosen because AI routing is automatic and needs its own off switch.
- **Command center is read-first:** a page that explains routing before it lets you edit it.

## Open questions

- Per-space instructions (free text like "only long-form essays, not news") appended to that space's entry in the AI payload, vs. one global instruction block. Likely both.
- Should rules be user-editable beyond kind (e.g. "domain github.com -> Dev Tools")? A deterministic domain rule list would be cheaper and more predictable than AI.
- Where to log decisions: `routed_by` says how, but not why. Store the AI's stated reason?

## Design (phased)

1. **Per-space AI-routing switch:** migration for `spaces.ai_routing`, toggle in space Settings dialog, `aiEligibleSpaces` honors it, tests.
2. **Routing page (`/routing`):** lists the routing order (rule -> linked group -> AI), the active rules (video), each space with its linked groups, auto-intake and AI-routing state, and the current AI instructions (built-in prompt + Settings additions, read-only).
3. **Per-space routing instructions:** `spaces.routing_hint` text, edited in the Settings dialog, passed to the AI next to name/description.
4. **Domain rules:** `routing_rules` table (`pattern`, `space_id`), evaluated before group/AI in `pickRoute`; editable on the page.
5. **Routing history:** recent captures with where each went and `routed_by`, to spot misroutes (builds on the [capture result panel](capture-result-panel.md)).

## Out of scope / later

- Learning rules automatically from manual corrections (beyond the existing "link this group" prompt).

## Follow-ups

- [ ] Step 1 (AI-routing switch) first; it is small and standalone.
