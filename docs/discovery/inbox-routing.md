# Inbox and routing

- **Status:** Built (steps 1-2); later steps designed
- **Date started:** 2026-11-14
- **Related:** [spaces.md](spaces.md), [video-space.md](video-space.md), [ai-link-import.md](ai-link-import.md), `src/lib/routing.ts`, `src/actions/capture.ts`, `src/actions/spaces.ts`, `src/components/group-actions.tsx`

## Goal

The feed is an **inbox**: the place to process captured links until each has a home. Capture routes what it can into spaces automatically; what it can't stays in the feed, where the user triages topic groups into spaces.

## Decisions

- **Save, then triage:** capture saves immediately (no preview step); triage happens in the inbox.
- **Routing order, first match wins:** (0) a user domain rule (e.g. `github.com` -> a space, see [routing-command-center.md](routing-command-center.md)), (1) kind rule (video link -> video space), (2) the blip's topic group is linked to a space, (3) the AI matched it to an existing space, (4) otherwise it stays in the feed. Implemented in `pickRoute`.
- **AI space matches apply automatically** (low friction). The AI is given each eligible space's name and description and must copy a name exactly; names it invents are ignored. Only general spaces with auto-intake on are eligible (video routes by rule).
- **Routing reason + audit log:** each decision gets a reason (AI: one short sentence it returns; rule/group: fixed text) stored on the blip and in the `routing_events` table, viewable at `/routing`. See [routing-command-center.md](routing-command-center.md).
- **`blips.routed_by` (`rule` | `group` | `ai`)** records how a blip was auto-routed so it isn't invisible; space views show "Auto-sorted by ...". Manual store and return-to-feed clear it.
- **Group labels don't stick once a group is triaged:** moving a group to a space (or creating a space from it) clears `group_id` on the moved blips. The group row stays linked to the space so future captures with that label route there.
- **Triage actions ignore the space's auto-intake switch:** the user asked explicitly.
- **Learning loop:** storing a blip by hand whose group isn't linked offers "Link group (+ move N more)", so the next capture on that topic routes itself.
- **Reprocess never moves a blip out of a space it is already in.**

## Open questions

- ~~Per-space AI-routing off switch?~~ Yes; built (`spaces.ai_routing`), see the [routing command center](routing-command-center.md).
- Is the space description enough signal for the AI, or do spaces need examples/keywords?

## Design

Capture -> OG fetch -> `organizeLinks` (now also returns `space`) -> `pickRoute` per link -> insert. Feed group headers get **Create space** and **Move to space** (`GroupActions`) backed by `createSpaceFromGroup` / `routeGroupToSpace`. `storeBlip` returns `suggestGroup` when the group is unlinked; `BlipCard` shows the toast action. Tests: `routing.test.ts`, `organize.test.ts`, `spaces.test.ts`.

## Later (designed, not built)

- Capture result panel: [plan](capture-result-panel.md).
- Routing command center and per-space AI-routing switch: [plan](routing-command-center.md).
- `/groups` management page: exploratory, see [../FUTURE.md](../FUTURE.md).

## Follow-ups

- [ ] Capture result panel.
- [x] Per-space AI-routing switch (routing command center step 1).
