# Video space

- **Status:** Built
- **Date started:** 2026-11-14
- **Related:** [spaces.md](spaces.md), `src/lib/video.ts`, `src/lib/video-space.ts`, `src/components/video-card.tsx`, `drizzle/0003_video_spaces.sql`, [../FUTURE.md](../FUTURE.md) (general vs. specialized spaces)

## Goal

Spaces can be specialized. A **video** space shows captured video links as a Pinterest-style tiled grid, with the thumbnail and an in-place player, and video links route there automatically at capture.

## Decisions

- **`spaces.kind` enum (`general` | `video`), default `general`:** one extensible column; the space page picks its view from it. Add new kinds to `spaceKinds` in `schema.ts`. `kind` is set at creation and not editable.
- **Routing is deterministic, not AI:** at import/reprocess a link that `parseVideoUrl` recognizes goes to the video space regardless of its AI topic group. Chosen over group-label matching so it never depends on model output.
- **Video space is created on first use** (`ensureVideoSpace`), named "Videos". If the video space has auto-intake off, routing is skipped.
- **YouTube only for now:** `parseVideoUrl` handles watch, youtu.be, shorts, live and embed URLs. Other sites are added as new branches in that one function (thumbnail + embed rules per provider).
- **No API key:** thumbnail is `i.ytimg.com/vi/<id>/hqdefault.jpg`, player is the `youtube-nocookie.com` embed iframe, loaded only on click so a page of tiles doesn't mount many players.
- **Existing YouTube blips swept once** by the migration (`0003_video_spaces.sql`), which creates the space only if YouTube blips exist. Creating or re-enabling auto-intake on a video space also sweeps unstored video blips.

## Open questions

- Vimeo and other providers (add when needed).
- Should the player open in a modal rather than in place?

## Design

Masonry via CSS columns (`columns-1 sm:2 lg:3 xl:4`, `break-inside-avoid`); Shorts render 9:16. Each card has an "Open on YouTube" link as the fallback for uploaders who disabled embedding. Capture sets `imageUrl` to the YouTube thumbnail for videos. Tests: `src/lib/video.test.ts`, `src/lib/video-space.test.ts`.

## Out of scope / later

- Playback tracking / watched state, channel metadata via oEmbed.

## Follow-ups

- [ ] Add Vimeo (and others) to `parseVideoUrl`.
- [ ] Type-specific capture UI for other kinds.
