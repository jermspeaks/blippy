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
- **A blip qualifies for the book space in one of two ways** (revised 2026-11-15 after non-books kept landing there):
  1. **Tier 1, certain from the URL (no API, no AI):** `parseBookUrl` recognizes book pages on Goodreads (`/book/show/`), Amazon (`/dp/` only when the id is a valid ISBN-10, since other ASINs are any product), Bookshop, Open Library, and the Big Five publishers: Penguin Random House (`/books/<id>/`), Simon & Schuster (ISBN-13 path), Hachette Book Group (`/titles/<author>/<title>/<isbn13>/`), HarperCollins (`/products/<slug>`, no ISBN in the URL) and Macmillan (`/books/<isbn13>`). Publisher blogs and author pages do not match. Other bookstores can be added to the same list later.
  2. **Tier 2, the AI names a book and a book database confirms it:** the capture AI call returns `book: {title, author}` only when the page is for one specific book: a store/publisher page, or a reference entry about the book itself such as its Wikipedia article (never newsletters, articles, reviews, author/film/series pages or lists). `confirmBook` then searches Google Books / Open Library by title + author; it must find a similar title with a matching author surname. No confirmation (including a very recent title the AI does not know, or a lookup error) means the blip stays out. "Add book" covers those by hand. Without an AI key, Tier 2 never runs.
  - **Topic-group and AI-space picks cannot place a blip in a book space** (`pickRoute`'s `bookSpaceIds`); only Tier 1, a confirmed Tier 2, a user domain rule, or a manual store can. The AI is still offered the book space, but its pick is ignored unless the book was verified.
- **Routing priority:** domain rule > video > **book (Tier 1 or confirmed Tier 2)** > topic group > AI. Reasons: "Book link" / "Book (named by AI, confirmed in book databases)", logged as `routed_by = rule`.
- **One lookup path ("hydration"):** after any blip lands in a book space (capture, reprocess, re-route, manual store, group move, space creation/conversion/sweep), `hydratePendingBooks` looks up blips that have no `book_details` row yet (25 per call; "Look up N more" on the space page does 50). This replaces per-flow special cases. A lookup never fails the operation.
- **Matching (details, not membership):** an ISBN in the URL -> `lookupByIsbn` (status `ok`). If the API has nothing, the blip **still qualifies**: the URL's ISBN is saved as `ok` and the blip is left as captured (edit it by hand); no title guessing follows. Without an ISBN (Goodreads, PRH, HarperCollins...), `lookupByTitle` on the cleaned page title (status `partial`, "Matched by title") needs similarity >= 0.6 and trust (book-site URL, or author evidence on the page). Tier 2 saves the details found while confirming (no second search).
- **Rate limits:** API calls happen only for Tier 1 details and Tier 2 candidates, at concurrency 2. A rate-limit/network error is **not** recorded as a failure (`deferred`): the blip stays without a details row, and "Look up N more" or the next hydration retries it. Only a clean "no match" is `failed`.
- **A clean no-match leaves the blip as captured** (original title and image) and record `failed`, so they are not retried automatically; the card's refresh button retries. A failed refresh keeps earlier good details.
- **Reprocess skips blips with book details** (it would overwrite the title and cover with generic page data).
- **Add by title/ISBN:** "Add book" dialog searches (ISBN or title/author), shows up to 5 candidates with cover, you pick the edition. Duplicates (same ISBN or link) are rejected. The blip URL is `books.google.com/books?vid=ISBN<isbn13>`.
- **Manual edit:** the pencil on each card opens a dialog to change title, authors, cover link, book link, publisher, year, pages and ISBN (`updateBook`; https links only). Saved edits set status `ok`, so a failed lookup stops showing as failed. Refreshing from the card replaces edits with looked-up data.
- **Details live in a 1:1 `book_details` table;** cover in `blips.image_url`, title in `blips.title`.
- **All outbound calls go to fixed API hosts** (Google Books, Open Library); saved page URLs are never fetched for book data.

## Open questions

- Converted spaces keep any existing non-book blips (rendered as plain cards). Bulk move-out is still open; new captures no longer add them.
- Other bookstore sites (beyond Bookshop, Amazon-with-ISBN and the Big Five) are a later addition to `parseBookUrl`. Publisher URL shapes for Hachette, HarperCollins and Macmillan were written from known patterns, not verified against live pages (those sites block automated requests).
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
