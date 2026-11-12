# AI link import (Capture)

- **Status:** Built
- **Date started:** 2026-11-11
- **Related:** `src/app/capture/page.tsx`, `src/actions/capture.ts`, `src/lib/ai/`, `src/lib/og.ts`, `src/lib/markdown-links.ts`

## Goal

Replace the one-blip quick-capture form with a large markdown textbox for daily notes that are mostly links. An AI turns them into structured blips (title, summary, image) shown as link cards in the feed, and related blips are grouped by topic.

Example input: a day's notes with Nvidia news links (one nested under another), YouTube talks, a PDF on GitHub, a press release.

## Decisions

- **Links are extracted by regex, not by the AI:** deterministic, handles malformed lines (e.g. `Title](url)` with no opening bracket) and URLs containing parentheses. The AI only describes and groups.
- **Image and metadata come from Open Graph/Twitter tags**, fetched server-side (8s timeout, 512 KB cap, redirects re-checked, private/loopback addresses blocked to prevent SSRF). The AI writes title and summary only.
- **Plain `fetch` to provider APIs, no AI SDK:** two providers (OpenAI, Anthropic) don't justify a dependency. Provider and model are chosen in Settings; the model list is fetched live from the provider.
- **API keys live in `.env.local`, never in the database:** `blippy.db` is tracked in git.
- **Graceful fallback:** with no key or a failed AI call, blips are still created from page metadata (with a warning). Reprocess refuses to overwrite data when the AI step fails.
- **Prompt:** a built-in system prompt defines the JSON contract; users append instructions in Settings but cannot replace it. Generation settings (temperature, top P, max tokens, penalties) are optional; blank means provider default. OpenAI reasoning models (`o<digit>`, `gpt-5*`) skip sampling params (assumed to reject them).
- **Grouping:** the AI returns a topic label per link. Groups with one member are dropped unless the label already exists. Existing group labels and space names are passed as preferred labels.
- **Dedupe by URL;** max 50 links per import.
- **Parsing is per item:** one bad AI entry must not discard the batch (a `summary: null` once broke a whole import).

## Open questions

- Re-processing loses the original nesting hint (nested bullets). Store it if grouping quality suffers.
- Preview-before-save step? Currently imports save directly.

## Design

Paste markdown -> `extractLinks` -> `fetchLinkMetadata` (concurrency 6) -> `organizeLinks` (one AI call) -> insert blips + groups in one transaction. Feed groups blips sharing a `group_id` into one section. Reprocess re-runs fetch + AI over existing link blips in chunks of 50 (cap 200).

Data: `blips` gains `title`, `summary`, `image_url`, `url`, `site_name`, `group_id`; new `blip_groups` and `app_settings` tables. See [../DATA_MODEL.md](../DATA_MODEL.md).

## Out of scope / later

- Non-link notes (plain-text ideas) as blips from the same box.
- Background/queued processing for large imports.

## Follow-ups

- [ ] Preview/edit step before saving.
- [ ] Persist nesting context for reprocess.
