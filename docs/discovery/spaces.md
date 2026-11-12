# Spaces

- **Status:** Built
- **Date started:** 2026-11-12
- **Related:** `src/actions/spaces.ts`, `src/app/spaces/`, `src/components/space-*.tsx`, `src/components/blip-card.tsx`, [ai-link-import.md](ai-link-import.md)

## Goal

Give blips a place to live once they have found a home. A user can create any number of spaces (e.g. "Obituaries"). Each feed card gets a fourth action, **Store**, to file the blip in the space it fits best. Spaces can also auto-intake: blips imported into a topic group that is linked to a space land there automatically.

Example: an obituary link goes into an "Obituaries" space.

## Decisions

- **Spaces hook into AI topic groups (`blip_groups`), not user categories:** import only ever produces groups. Assumption to revisit if categories were meant.
- **A group links to at most one space; a space can have many groups** (`blip_groups.space_id`). No join table.
- **Stored blips leave the feed** (`blips.space_id` set; feed filters `space_id IS NULL`). "Return to feed" clears it.
- **Auto-intake is a per-space switch.** Linking a group, creating a same-named space, or turning auto-intake on also stores the group's existing unstored blips ("we get all the blips in that group").
- **Name matching:** a new group whose label matches a space name (case-insensitive) auto-links; space names are passed to the AI as preferred labels so related links get that label. Space names are unique (case-insensitive).
- **Unlinking a group does not evict stored blips; deleting a space returns its blips to the feed.**
- **Reprocess never moves a blip out of a space it is already in.**

## Open questions

- Should a space also accept user categories as an intake key?
- Should fizzling/snoozing interact with stored blips (currently stored blips are not resurfaced)?
- What does a space *do* beyond holding blips (views, exports, per-space prompts)? Ties into [lifecycle-pathways.md](lifecycle-pathways.md).
- Moving a stored blip directly between spaces (today: return to feed, then store).

## Design

Server actions in `src/actions/spaces.ts` (create/update/delete, link/unlink group, store/unstore, `sweepSpace`). Pages: `/spaces` (list + create), `/spaces/[id]` (settings, linked groups, stored blips). Capture's `makeGroupResolver` decides intake for new/reprocessed blips. Covered by `src/actions/spaces.test.ts` (temp SQLite DB). Schema in [../DATA_MODEL.md](../DATA_MODEL.md).

## Out of scope / later

- Space-specific templates or structured fields (e.g. recipe book).
- Sharing/export of a space.

## Follow-ups

- [ ] Decide on categories as an intake key.
- [ ] Move-between-spaces action.
