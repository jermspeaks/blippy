# Capture result panel

- **Status:** Designed (plan, not built)
- **Date started:** 2026-11-14
- **Related:** [inbox-routing.md](inbox-routing.md), `src/components/capture-form.tsx`, `src/actions/capture.ts`

## Goal

After a capture, show where every link went instead of a one-line toast ("Created N blips, M stored in spaces"). Because AI routing is automatic, the user needs to see and correct outcomes right when they happen, then move on to triage the leftovers.

Example: "12 links: 4 to Videos (link type), 3 to Books (AI), 2 to Obituaries (topic), 3 need triage."

## Decisions

- **Stay on /capture and show a panel** instead of redirecting to the feed immediately; the panel links to the feed for triage.
- **`importMarkdown` returns per-blip outcomes**, not just counts, so the panel can list them. Each outcome: blip id, title, `spaceId | null`, `routedBy`.
- **Corrections happen inline:** each routed row has "Move..." (pick another space) and "Return to feed"; reuses `storeBlip` / `unstoreBlip`.

## Open questions

- Should reprocess show the same panel?
- Cap on rows shown (import max is 50, so probably show all, grouped by destination).

## Design

1. Extend `ImportResult` with `outcomes: { blipId, title, spaceId, spaceName, routedBy }[]` (built from the `rows` already assembled in `importMarkdown`).
2. New `CaptureResult` component: rows grouped by destination space plus a "Needs triage" group; each group header shows the count and the routing reason (`rule` / `group` / `ai`).
3. `CaptureForm` renders it after success; "Go to feed" button; keep the textbox cleared.
4. Tests: unit test for the outcome shaping; e2e only if a mock AI path exists.

## Out of scope / later

- Undo-all for an import.

## Follow-ups

- [ ] Build steps 1-3.
