# Reading list (read later)

- **Status:** Built (phases 1-3)
- **Date started:** 2026-11-16
- **Related:** [spaces.md](spaces.md), [ai-link-import.md](ai-link-import.md), [code-space.md](code-space.md) (lookup/hydration pattern), `src/lib/og.ts` (`fetchPageHtml`, the SSRF-guarded fetch), `src/lib/article.ts`, `src/actions/reading.ts`, `src/app/reading/`, `src/components/reading-table.tsx`, `src/components/read-later-button.tsx`, `drizzle/0011_reading_items.sql`, [../FUTURE.md](../FUTURE.md)

## Goal

Some saved articles are really "read later". A **reading list**, separate from spaces, keeps a stored copy of the article and shows it in a distraction-free reader: just the text, images and media, with no ads or page chrome. Example: from the feed or a space, click "Read later" on a blip; it appears in `/reading` with a reading time, and opening it shows the clean article even if the original page changes or disappears.

## Decisions

- **Separate from spaces; a blip can be in both.** The reading list is its own thing (`/reading`, own nav item). Adding a blip does **not** move it: it stays in its space or in the feed, and shows an "In reading list" marker. Chosen so spaces keep organizing by topic while the list organizes by "what I will read".
- **Added from the feed card, a space item or the blip detail page, or by pasting a URL.** A pasted URL goes through the normal capture pipeline (so it also becomes a blip and may be routed to a space) and is then added to the list. A URL that is already a blip reuses that blip.
- **The article text is stored** (sanitized HTML) when the item is added, so it reads offline and survives link rot. Extraction uses Mozilla Readability (the Firefox Reader View engine) on the fetched page.
- **Images and media link to the originals** for v1 (no local image cache). Images can break if the site removes them; local copies are a follow-up.
- **Stored text is purged when its blip is deleted** (decided 2026-11-16). `reading_items.blip_id` is a required FK with `ON DELETE CASCADE` (every item has a blip, including pasted URLs), so deleting a blip removes its stored article and highlights. **Fizzling is not deleting:** a fizzled blip keeps its reading item. Anything that deletes stored text asks first in a **confirmation dialog** (below).
- **Deletion needs a confirmation dialog.** Removing an item from the reading list, and deleting a blip that has a stored article, open a dialog that names the article and says its saved text and highlights will be permanently deleted, with a destructive "Delete" button and a Cancel. No UI deletes blips today (`deleteBlip` exists in `src/actions/blips.ts` but is unused; fizzle is the soft delete), so the blip case applies if/when a delete control is added. Uses the shadcn `Dialog` (the app's other confirms use `window.confirm`).
- **Sidebar placement:** "Reading" goes directly below "Spaces" in the sidebar for now.
- **Scope: all four features are planned, built in phases** (below): status + reading time, scroll position, reader display settings, highlights and notes.

## Design

### Data (new tables, migration after 0010; also record in `docs/DATA_MODEL.md`)

- `reading_items`: `id`, `blip_id` (required, unique FK -> `blips.id`, cascade delete), `url`, `title`, `byline`, `site_name`, `lead_image_url`, `excerpt`, `content_html` (sanitized), `word_count`, `reading_minutes`, `extract_status` (`ok` | `failed`), `extract_error`, `status` (`unread` | `reading` | `read` | `archived`), `scroll_pct` (0-1, phase 2), `added_at`, `read_at`, `fetched_at`.
- `reading_highlights` (phase 3): `id`, `reading_item_id` (FK, cascade), `exact`, `prefix`, `suffix` (a text-quote anchor that survives re-rendering), `note`, `color`, `created_at`.
- Reader display settings (phase 2) live in `localStorage` (per browser, not data worth syncing).

### Extraction pipeline (`src/lib/article.ts`, `src/lib/article-extract.ts`)

1. **Fetch** the page with the same SSRF guard as `og.ts` (public hosts only, redirects re-checked), with a larger size cap (about 3 MB) and a longer timeout (about 15 s). Only `text/html`.
2. **Parse** with jsdom and run **Readability** to get title, byline, site name, lead image and article HTML. Resolve relative links and image URLs against the page URL.
3. **Sanitize** with an allowlist (`sanitize-html`): headings, paragraphs, lists, links (http/https only, `rel="noopener noreferrer"`), images (https only, lazy, no referrer), figures/captions, blockquotes, code/pre, tables, and `iframe` only for YouTube-nocookie and Vimeo. No scripts, styles, forms or event handlers. The reader renders this HTML only after sanitizing, never raw page HTML.
4. **Measure:** word count and reading minutes (about 230 wpm).
5. **Failure is a state, not an error:** paywalled, login-gated, JS-rendered or too-short (under about 150 words) pages are saved as `extract_status = failed` with a reason and an "Open original" link; "Try again" re-runs it. A network or rate-limit error is retried the same way and never blocks adding the item.

### Pages and components

- **`/reading`:** a table (matching the code space) with Unread / Reading / Read / Archived filters: title + site, reading time, added date, progress, and actions (mark read, archive, remove). "Add link" box at the top.
- **`/reading/[id]`:** the reader: title, byline, site, reading time, "Open original", status controls, display settings, article body. Narrow measure, readable typography, images constrained to the column.
- **"Read later" button** on feed cards, space items and the blip detail page; becomes "In reading list" (links to the item) once added.
- **Server actions** in `src/actions/reading.ts` (Zod-validated): `addToReadingList(blipId)`, `addUrlToReadingList(url)`, `setReadingStatus`, `saveReadingProgress`, `removeFromReadingList`, `retryExtraction`, highlight CRUD.

### Dependencies and risks

- New packages: `@mozilla/readability`, `sanitize-html` (+ `@types/sanitize-html`, `@types/jsdom`), and **`jsdom` moved from devDependencies to dependencies**. jsdom is already on Next's built-in `serverExternalPackages` list, so no `next.config.ts` change was needed.
- Fetching article pages is a new outbound call to arbitrary public sites (unlike the code and book spaces, which only call fixed API hosts); the SSRF guard and size/time limits are what keep it safe.
- Stored articles grow the SQLite file; sanitized HTML is typically tens of KB each, so this is fine for a personal list.

## Phases

1. **Phase 1, the core:** tables, extraction + sanitizing, `/reading` table, reader page, status (unread/reading/read/archived), reading time, "Read later" button with feed/space marker, paste-a-URL add, retry on failed extraction.
2. **Phase 2, comfort:** remember scroll position (saved debounced via a server action, restored on open; "reading" status set automatically once you scroll), reader display settings (font size, width, light/dark/sepia).
3. **Phase 3, highlights and notes:** select text to save a highlight with an optional note; highlights re-applied from the text-quote anchor; a per-article list of highlights.

## Phase 1 notes (as built)

- **Extraction:** `charThreshold` 300 for Readability, then a **100-word minimum**; below that the item is saved as failed ("Too little text found. The page may be paywalled, behind a login, or built with JavaScript."). Checked on a real essay (Paul Graham, about 11,600 words, 51 min) and a Wikipedia article. Localhost and private addresses are blocked.
- **Sanitizer allowlist** (`sanitizeArticleHtml`): links http/https/mailto, forced `target="_blank" rel="noopener noreferrer"`; images https only (http is upgraded), lazy, `no-referrer`; iframes only YouTube/YouTube-nocookie/Vimeo; code `language-*` classes only. Unit-tested against scripts, handlers, `javascript:` links, data URIs and foreign iframes.
- **Adding blocks until the page is fetched** (up to 15 s); the button shows "Saving...". A failed extraction is saved as a state with the reason and `Refresh text` retries it; a failed refresh keeps an earlier good copy.
- **`/reading`:** Unread / Reading / Read / Archived tabs with counts (the default tab is Unread), table of article, time and added date; mark read / back to Unread, archive and delete (confirmation dialog). "Reading" status exists in the schema and tabs but nothing sets it until phase 2 (scroll tracking).
- **`/reading/[id]`:** the reader (title, byline, site, minutes, Open original, Mark read / Archive / Refresh text / Delete) with `.reader-content` styles in `globals.css`.
- **"Read later"** appears on feed cards, stored items in general spaces and the blip detail page for blips with a link (not on book, video or code rows); it becomes "In reading list". Sidebar: "Reading" directly below "Spaces".
- **Deleting a blip purges its reading item** (cascade; tested). Fizzling keeps it. Deleting from the list asks for confirmation and keeps the blip.

## Phase 2 notes (as built)

- **Paragraph spacing fix:** Readability wraps article text in nested divs, so the first reader CSS (spacing on direct children only) left paragraphs touching. Spacing now lives on the elements themselves (`p`, lists, quotes, figures...), with heading margins and tighter last-child rules.
- **Scroll position:** `reading_items.scroll_pct` (migration 0012, 0-1). `ReaderShell` listens to the scrolling element (the app scrolls inside `<main>`, not the window), saves the position debounced (0.8 s, plus on tab hide and leaving the page; changes under 0.5% are skipped) through `saveReadingProgress`, and restores it on open. Restore retries after layout settles (0, 0.3, 0.9, 2 s) and stops the moment you scroll yourself. Positions are only saved while the article is **unread or reading**; reopening a read or archived article starts at the top and overwrites nothing. Marking an article **Unread** resets progress to 0.
- **Status:** the first scroll past 2% moves an unread article to **reading** (the Reading tab now fills). Reaching the end does **not** mark it read; finishing stays an explicit button. The `/reading` table has a Progress column (percent, for items in Reading).
- **Display settings** (the "Display" button on the reader): text size (small, medium, large, extra large), width (narrow, medium, wide) and theme (match app, light, sepia, dark). Stored per browser in `localStorage` (`blippy.reader`); applied as data attributes on `.reader-shell`, with themes overriding the color variables so the header, buttons and article all follow. Settings load after first paint, so the default look can flash briefly.

## Phase 3 notes (as built)

- **Creating:** select text in the article and a small toolbar appears over the selection with four colors (yellow, green, blue, pink) and a **Note** button. A color saves immediately; Note opens a dialog for the note and color. Selections inside an existing highlight don't show the toolbar, so highlights never overlap. Max 2,000 characters per highlight, 2,000 per note.
- **Anchoring:** `reading_highlights` (migration 0013) stores the quoted text plus up to 32 characters before and after (`src/lib/highlight-anchor.ts`), not a DOM position. On load, `locate` finds the quote in the article text (the context picks the right one when the quote repeats) and `applyMark` wraps it in `<mark data-highlight-id>`, one per text node, skipping whitespace between paragraphs. Highlights spanning several paragraphs or links work.
- **Editing:** click a highlight to open it (note, color, Delete). Deleting asks a second time ("Delete highlight and its note?" when there is a note). Highlights with a note get a dotted underline.
- **Highlights list:** the "Highlights (N)" button shows every highlight in reading order with its note; click a quote to scroll to it. A highlight whose passage can't be found is listed with a warning instead of being dropped.
- **Refresh text caveat:** re-fetching an article replaces its stored text; highlights are re-anchored by their quote, so edits to a highlighted passage can orphan it (shown in the list, deletable).
- **A bug the component test caught:** React re-sets `innerHTML` on a re-render when the `dangerouslySetInnerHTML` object changes identity, which wiped the marks right after they were applied. The object is now memoized.
- Highlights are deleted with their article (cascade).

## Open questions

- Stored text does not expire on a schedule (decided: kept until removed or its blip is deleted).
- Highlights export: built. The Highlights panel has "Copy as markdown" and "Download .md" (title, source link, each quote as a blockquote with its note, in article order). Obsidian-specific export is not built.

## Out of scope / later

- Downloading images locally; PDF and non-HTML sources; browser extension capture; text-to-speech; sync across devices beyond the shared server.

## Follow-ups

- [x] Phase 1: core reading list (built 2026-11-16; see Phase 1 notes below).
- [x] Phase 2: scroll position and display settings (built 2026-11-16; see Phase 2 notes below).
- [x] Phase 3: highlights and notes (built 2026-11-16; see Phase 3 notes below).
