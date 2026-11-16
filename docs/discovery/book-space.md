# Book space

- **Status:** Built (steps 1-4); price is a stretch goal
- **Date started:** 2026-11-15
- **Related:** [video-space.md](video-space.md) (pattern followed), [spaces.md](spaces.md), [routing-command-center.md](routing-command-center.md), `src/lib/book.ts`, `src/lib/book-lookup.ts`, `src/lib/book-hydrate.ts`, `src/lib/book-space.ts`, `src/components/book-card.tsx`, `drizzle/0009_book_details.sql`, [../FUTURE.md](../FUTURE.md)

## Goal

A **book** space shows saved books as a Pinterest-style masonry of cards: **cover, title, author** (plus year and publisher). Book links route there automatically, and a book without a link can be added by title or ISBN. Example: save a Goodreads or Bookshop link and a card appears in Books with the cover, "Atomic Habits" and "James Clear".

## Data sources (probed 2026-11-15)

| Source | Used for | Notes |
| --- | --- | --- |
| Google Books API | title, authors, publisher, year, pages, description, fallback cover, ISBN | **Needs `GOOGLE_BOOKS_API_KEY`** (keyless calls share a quota and returned 429). Primary source. |
| Open Library (`search.json`, `covers.openlibrary.org`) | higher-resolution cover by ISBN (checked with a HEAD request); full fallback for lookups when there is no key or Google fails | No key. Its per-ISBN data endpoint was too sparse to be primary. |
| Goodreads / Amazon / Bookshop pages | not fetched for details | Amazon and Bookshop block scripts; the URL itself (ISBN) is parsed instead. |

## Decisions

- **`spaces.kind = "book"`**, same mechanism as video. Unlike video, an existing **general space can be converted** (Settings -> "Convert to book space"; one-way, only while no other book space exists). If no book space exists when a book link arrives, a general space named "Books" is **adopted** (converted) rather than creating a duplicate; otherwise "Books" is created.
- **Price is a stretch goal, not built.** Google's price is an ebook/list price available only for some titles, and there is no free source for print prices. If added later: a nullable price on `book_details` (Google `saleInfo`, labelled with source and date) and/or a manual print-price field on the card.
- **Intake is deterministic by URL, plus the AI:** `parseBookUrl` recognizes Goodreads (`/book/show/`), Amazon (`/dp/` only when the id is a valid ISBN-10, since other ASINs are any product), Bookshop (ISBN-13 or `/p/books/` pages), Open Library, Simon & Schuster (ISBN-13) and Penguin Random House (`/books/<id>/`). Book spaces **stay eligible for AI routing** (only video is excluded), so book-like pages from other sites still reach the space; the AI route and the URL rule both end in the same lookup.
- **Routing priority:** domain rule > video > **book** > topic group > AI. Reason "Book link", logged as `routed_by = rule`.
- **One lookup path ("hydration"):** after any blip lands in a book space (capture, reprocess, re-route, manual store, group move, space creation/conversion/sweep), `hydratePendingBooks` looks up blips that have no `book_details` row yet (25 per call; "Look up N more" on the space page does 50). This replaces per-flow special cases. A lookup never fails the operation.
- **Matching is exact when it can be, cautious when it can't:** an ISBN in the URL -> `lookupByIsbn` (status `ok`). Otherwise `lookupByTitle` on the cleaned page title (status `partial`, shown as "Matched by title"), which needs (a) title similarity >= 0.6 and (b) **trust**: the URL is on a book site, or the page shows evidence (an author surname of 4+ letters in the title/summary/URL, or a "(novel)" or `/book` label). Added after the first run on real data matched generic titles ("Story Club", "Quantum Computing") to the wrong books.
- **Failed lookups leave the blip as captured** (original title and image) and record `failed`, so they are not retried automatically; the card's refresh button retries. A failed refresh keeps earlier good details.
- **Reprocess skips blips with book details** (it would overwrite the title and cover with generic page data).
- **Add by title/ISBN:** "Add book" dialog searches (ISBN or title/author), shows up to 5 candidates with cover, you pick the edition. Duplicates (same ISBN or link) are rejected. The blip URL is `books.google.com/books?vid=ISBN<isbn13>`.
- **Manual edit:** the pencil on each card opens a dialog to change title, authors, cover link, book link, publisher, year, pages and ISBN (`updateBook`; https links only). Saved edits set status `ok`, so a failed lookup stops showing as failed. Refreshing from the card replaces edits with looked-up data.
- **Details live in a 1:1 `book_details` table;** cover in `blips.image_url`, title in `blips.title`.
- **All outbound calls go to fixed API hosts** (Google Books, Open Library); saved page URLs are never fetched for book data.

## Open questions

- Converted spaces keep their mixed blips (articles, newsletters). They render as plain cards with a "No book details found" note. Should non-book blips be movable out in bulk?
- Series/editions: dedupe is by exact ISBN-13 only (different editions of one book are different cards).
- Sorting by author or year; filtering to unmatched.

## Design

**Modules:** `book.ts` (URL + ISBN parsing), `book-lookup.ts` (Google/Open Library search, cover selection, title similarity and evidence; fetch and key injectable for tests), `book-hydrate.ts` (pending query, lookup, save), `book-space.ts` (`ensureBookSpace` with adoption, `sweepBookBlips`), `kind-spaces.ts` (shared video/book space resolution used by capture, reprocess and re-route), `actions/books.ts` (`fetchMissingBookDetails`, `refreshBook`, `searchBookCandidates`, `addBook`), `convertSpaceToBook` in `actions/spaces.ts`.

**UI:** space page for `kind = book` renders `BookCard`s in CSS columns (`columns-2 md:3 lg:4 xl:5`): cover at natural aspect (placeholder tile if missing), title, authors, year/publisher, provenance note, and Open / refresh / return / fizzle. Header has Add book and "Look up N more".

**Data model:** `book_details` (`blip_id` PK -> blips, cascade; `isbn13`, `authors` JSON, `publisher`, `published_year`, `page_count`, `lookup_status` ok/partial/failed, `fetched_at`). See [../DATA_MODEL.md](../DATA_MODEL.md).

**Failure modes:** no key -> Open Library only (still covers/authors); Google 429/5xx -> Open Library fallback; both down -> `failed`, retry from the card; a wrong match is visible via "Matched by title" and the refresh button.

**Real-data run (2026-11-15):** converting the existing 34-blip "Books" space: 2 exact, 5 title matches (all correct after the evidence rule), 21 no-match (mostly articles/newsletters), 6 without a URL.

## Out of scope / later

- Price (see decisions), reading status and ratings (ties into [lifecycle-pathways.md](lifecycle-pathways.md)), library availability, audiobooks.

## Follow-ups

- [x] Book kind, URL parsing, routing, space adoption/conversion.
- [x] Lookup (Google Books + Open Library) and `book_details`.
- [x] Masonry `BookCard` view.
- [x] Add by title/ISBN.
- [x] Edit a book's details and cover by hand.
- [ ] Stretch: price (Google `saleInfo` or manual print price), price sort.
- [ ] Sort by author/year; filter unmatched; bulk move non-books out.
