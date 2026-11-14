# Re-route feed blips

- **Status:** Built
- **Date started:** 2026-11-14
- **Related:** [inbox-routing.md](inbox-routing.md), [routing-command-center.md](routing-command-center.md), `src/actions/reroute.ts`, `src/lib/route-helpers.ts`, `src/components/reroute.tsx`

## Goal

When a new space is created or routing rules change, blips already waiting in the feed should be able to follow the new routing. Capture only routes at ingestion time, and Reprocess (on `/capture`) is a heavy refresh that rewrites titles, summaries and groups, so neither fits.

Example: add a rule `github.com -> Dev Tools`, click **Re-route**, and the 9 GitHub links in the feed move to Dev Tools.

## Decisions

- **Separate action, not Reprocess:** re-route only changes *where* a blip goes; it never touches title, summary, image or group, and does no page fetches. Reprocess stays as the "refresh previews and summaries" tool.
- **Scope: feed blips due today** (active, not stored in a space, not snoozed past today). Blips in a space are never moved. Snoozed blips are out of scope (see Later).
- **Same routing order as capture:** domain rule, video, linked topic group (space auto-intake on), then AI match.
- **AI step is included by default** and reuses each blip's stored title, summary and site (no refetch). It is only asked about blips the deterministic steps could not place, and only if some space is AI-eligible. With no key, or on failure, the deterministic steps still apply and a warning is shown (unlike Reprocess, which aborts).
- **Log only blips that moved** (`routing_events.source = "reroute"`); "still no match" is not logged, so repeated clicks do not add noise.
- **No confirmation and no dry run:** it is automatic and reversible (Return to feed). A toast reports "Moved 7 of 42: 3 by rule, 2 by topic, 2 by AI" with a link to the Routing log.
- **Auto-offer:** after creating a space (New space dialog, or Create space from a feed group) or adding a routing rule, a toast offers "Re-route N blips in your feed?" with one click.
- **Chunking:** at most 200 blips per run (AI in chunks of 50); if more remain, the toast says so and a second run continues.

## Open questions

- Should changing a space's description, linking a topic group, or turning on AI routing also trigger the offer?
- Should a re-route preview ("would move 9") exist later? Skipped for now.

## Design

`countRerouteCandidates` and `rerouteFeedBlips` in `src/actions/reroute.ts`; shared helpers (`aiSpaceOptions`, `aiSpaceId`, `routingEvent`) moved to `src/lib/route-helpers.ts` so capture, reprocess and re-route share them; `endOfToday` moved to `src/lib/due.ts`. UI: `RerouteButton` in the feed header ("Re-route N blips"), `offerReroute` toast helper. Tests: `src/actions/reroute.test.ts` (rule/group/video/AI paths, due-today scope, moved-only logging, no-key warning).

## Later (separate features)

- **Resurface snoozed blips:** snoozed blips need a way to come back into the feed (earlier than their snooze date, or on schedule). Not built.
- **Re-route snoozed blips:** only after resurfacing exists; re-route runs on blips once they are due again.

## Follow-ups

- [ ] Resurfacing snoozed blips.
- [ ] Re-route for snoozed blips, after resurfacing.
