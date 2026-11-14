# Routing command center

- **Status:** Mostly built (domain rules, page and audit log done; manual-correction logging open)
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

- Should rules go beyond host + path prefix (regex, keywords)? Not yet; revisit if the log shows misroutes host rules can't express.

## Design (phased)

1. **Per-space AI-routing switch (built):** `spaces.ai_routing` (migration 0005), checkbox in the space Settings dialog (general spaces only), "AI routing" column on the spaces table, `aiEligibleSpaces` (in `src/lib/routing.ts`) honors it alongside auto-intake. Tests in `routing.test.ts` and `spaces.test.ts`.
2. **Routing page (built):** `/routing` explains the routing order (domain rule -> link type -> topic group -> AI), lists domain rules, shows each space with its linked groups, auto-intake and AI-routing state, and shows the built-in prompt plus the user's Settings additions (read-only).
3. **Routing reason + audit log (built):** the AI returns a short `reason` with each `space` pick. Every capture/reprocess decision (including "left in the feed") is written to the `routing_events` audit table (migration 0006) with the blip title, URL, space name, `routed_by`, reason and source; entries survive blip/space deletion. `blips.routed_reason` also holds the reason, shown as a tooltip on the "Auto-sorted" note in space views. Rule and group routes get fixed reasons. The log is the `/routing` page (sidebar "Routing"): totals per outcome, filters (AI / topic group / rule / left in feed), latest 200. Tests: `capture.test.ts` (mocked OG + AI), `routing.test.ts`, `organize.test.ts`.
3b. **Global routing instructions (built, via Settings):** the existing "additional instructions" setting is appended to the prompt; `/routing` displays it and the built-in prompt read-only and links to Settings rather than duplicating the editor.
4. **Domain rules (built):** `routing_rules` table (migration 0008; `pattern` = normalized `host[/path]`, `space_id`), evaluated first in `pickRoute` (ahead of the video rule, group and AI), reason "Domain rule: <pattern>", logged as `routed_by = rule`. Matches subdomains and path prefixes at segment boundaries; the longest pattern wins. Add/delete on `/routing`; rules are removed when their space is deleted. Tests: `routing.test.ts`, `capture.test.ts`.
5. **Routing history:** covered by the audit log above; remaining work is surfacing it in the [capture result panel](capture-result-panel.md) and logging manual corrections (store / return to feed / group moves) as events.

## Out of scope / later

- Learning rules automatically from manual corrections (beyond the existing "link this group" prompt).

## Follow-ups

- [x] Step 1: AI-routing switch.
- [x] Step 3: routing reason + audit log (`/routing`).
- [x] Step 2: command-center explanation on the `/routing` page.
- [x] Step 4: domain rules.
- [ ] Log manual corrections as audit events.
