import { toIsbn13 } from "@/lib/book";

export type BookInfo = {
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn13: string | null;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  description: string | null;
  coverUrl: string | null;
  /** Stable page for the book, used as the blip URL when added without a link. */
  infoUrl: string | null;
};

export type LookupDeps = {
  fetch?: typeof fetch;
  /** Google Books API key; defaults to GOOGLE_BOOKS_API_KEY. Without one, Open Library is used. */
  googleKey?: string | null;
};

const TIMEOUT_MS = 8000;
const MAX_RESULTS = 5;
/** Minimum title similarity to accept a title-only match as the same book. */
export const MIN_TITLE_SIMILARITY = 0.6;

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** How alike a saved page title and a candidate book are (0..1), with or without its subtitle. */
export function titleSimilarity(
  pageTitle: string,
  book: { title: string; subtitle: string | null }
): number {
  const page = words(pageTitle);
  return Math.max(
    jaccard(page, words(book.title)),
    jaccard(page, words(`${book.title} ${book.subtitle ?? ""}`))
  );
}

/** Drop site suffixes ("... | Penguin", "... - Goodreads") and trailing "by Author". */
export function cleanPageTitle(raw: string): string {
  return raw
    .replace(/\s+[|·–—-]\s+[^|·–—-]*$/u, (m) => (m.length < 40 ? "" : m))
    .replace(/\s+by\s+[\p{L}.'\s-]+$/iu, "")
    .replace(/\s*\((?:novel|book|paperback|hardcover|kindle edition)\)\s*$/i, "")
    .trim();
}

function https(url: string | null | undefined) {
  return url ? url.replace(/^http:\/\//, "https://") : null;
}

const year = (d: string | undefined) => {
  const y = Number(d?.slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
};

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    infoLink?: string;
  };
};

export function fromGoogle(v: GoogleVolume): BookInfo | null {
  const i = v.volumeInfo;
  if (!i?.title) return null;
  const ids = i.industryIdentifiers ?? [];
  const isbn13 =
    toIsbn13(ids.find((x) => x.type === "ISBN_13")?.identifier) ??
    toIsbn13(ids.find((x) => x.type === "ISBN_10")?.identifier);
  // Google thumbnails default to a curled-page effect; drop it.
  const thumb = https(i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail)?.replace(
    /&edge=curl/,
    ""
  );
  return {
    title: i.title,
    subtitle: i.subtitle ?? null,
    authors: i.authors ?? [],
    isbn13,
    publisher: i.publisher ?? null,
    publishedYear: year(i.publishedDate),
    pageCount: i.pageCount && i.pageCount > 0 ? i.pageCount : null,
    description: i.description ?? null,
    coverUrl: thumb ?? null,
    infoUrl: isbn13
      ? `https://books.google.com/books?vid=ISBN${isbn13}`
      : (https(i.infoLink) ?? null),
  };
}

type OpenLibraryDoc = {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  isbn?: string[];
  first_publish_year?: number;
  cover_i?: number;
  publisher?: string[];
  number_of_pages_median?: number;
};

export function fromOpenLibrary(d: OpenLibraryDoc): BookInfo | null {
  if (!d.title) return null;
  const isbn13 = (d.isbn ?? []).map(toIsbn13).find(Boolean) ?? null;
  return {
    title: d.title,
    subtitle: d.subtitle ?? null,
    authors: d.author_name ?? [],
    isbn13,
    publisher: d.publisher?.[0] ?? null,
    publishedYear: d.first_publish_year ?? null,
    pageCount: d.number_of_pages_median ?? null,
    description: null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    infoUrl: isbn13 ? `https://openlibrary.org/isbn/${isbn13}` : null,
  };
}

async function getJson<T>(f: typeof fetch, url: string): Promise<T> {
  const res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function searchGoogle(q: string, key: string, f: typeof fetch): Promise<BookInfo[]> {
  const url =
    "https://www.googleapis.com/books/v1/volumes?printType=books" +
    `&maxResults=${MAX_RESULTS}&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const data = await getJson<{ items?: GoogleVolume[] }>(f, url);
  return (data.items ?? []).map(fromGoogle).filter((b): b is BookInfo => !!b);
}

async function searchOpenLibrary(
  query: { isbn?: string; q?: string },
  f: typeof fetch
): Promise<BookInfo[]> {
  const params = new URLSearchParams({
    limit: String(MAX_RESULTS),
    fields: "title,subtitle,author_name,isbn,first_publish_year,cover_i,publisher,number_of_pages_median",
  });
  if (query.isbn) params.set("isbn", query.isbn);
  else params.set("q", query.q ?? "");
  const data = await getJson<{ docs?: OpenLibraryDoc[] }>(
    f,
    `https://openlibrary.org/search.json?${params}`
  );
  return (data.docs ?? []).map(fromOpenLibrary).filter((b): b is BookInfo => !!b);
}

/** Open Library's cover is higher resolution than Google's; use it when it exists for this ISBN. */
async function betterCover(info: BookInfo, f: typeof fetch): Promise<BookInfo> {
  if (!info.isbn13) return info;
  try {
    const url = `https://covers.openlibrary.org/b/isbn/${info.isbn13}-L.jpg`;
    const res = await f(`${url}?default=false`, {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ...info, coverUrl: url };
  } catch {
    // keep whatever cover we had
  }
  return info;
}

/** Every provider that was tried failed (rate limit, network): "unknown", not "no such book". */
export class LookupUnavailableError extends Error {
  constructor() {
    super("Book lookup unavailable");
  }
}

/**
 * Google first (needs a key), Open Library when there is no key or Google fails/returns nothing.
 * Throws LookupUnavailableError when nothing was found and a provider errored, so callers
 * can retry later instead of recording a final "no match".
 */
async function search(
  query: { isbn?: string; q: string; plain?: string },
  deps: LookupDeps
): Promise<BookInfo[]> {
  const f = deps.fetch ?? fetch;
  let errored = false;
  const key = deps.googleKey === undefined ? process.env.GOOGLE_BOOKS_API_KEY : deps.googleKey;
  if (key) {
    try {
      const out = await searchGoogle(query.isbn ? `isbn:${query.isbn}` : query.q, key, f);
      if (out.length) return out;
    } catch (err) {
      errored = true;
      console.error("Google Books lookup failed", err instanceof Error ? err.message : err);
    }
  }
  try {
    const out = await searchOpenLibrary(
      query.isbn ? { isbn: query.isbn } : { q: query.plain ?? query.q },
      f
    );
    if (out.length === 0 && errored) throw new LookupUnavailableError();
    return out;
  } catch (err) {
    if (err instanceof LookupUnavailableError) throw err;
    console.error("Open Library lookup failed", err instanceof Error ? err.message : err);
    throw new LookupUnavailableError();
  }
}

/** Free-text search for the "add a book" box: an ISBN looks up that edition, anything else is a title/author query. */
export async function searchBooks(text: string, deps: LookupDeps = {}): Promise<BookInfo[]> {
  const q = text.trim();
  if (!q) return [];
  const isbn = toIsbn13(q);
  let found: BookInfo[];
  try {
    found = await search({ isbn: isbn ?? undefined, q }, deps);
  } catch {
    return []; // the add box just shows "no results"
  }
  return Promise.all(found.map((b) => betterCover(b, deps.fetch ?? fetch)));
}

/** Exact lookup by ISBN. */
export async function lookupByIsbn(isbn13: string, deps: LookupDeps = {}): Promise<BookInfo | null> {
  const [first] = await search({ isbn: isbn13, q: isbn13 }, deps);
  return first ? betterCover({ ...first, isbn13: first.isbn13 ?? isbn13 }, deps.fetch ?? fetch) : null;
}

/**
 * Does the page itself give evidence this is the book: an author's surname
 * (4+ letters) appears in its title, summary or URL, or it is labelled a
 * novel/book. Generic titles ("Story Club") otherwise match the wrong book.
 */
export function hasBookEvidence(
  book: Pick<BookInfo, "authors">,
  page: { title: string; summary: string | null; url: string | null }
): boolean {
  const hay = `${page.title} ${page.summary ?? ""} ${page.url ?? ""}`.toLowerCase();
  if (/\((?:novel|book)\)|\/book(?:s)?(?:[/?#_-]|$)|_\(novel\)/.test(hay)) return true;
  return book.authors.some((a) => {
    const surname = a.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";
    return surname.length >= 4 && hay.includes(surname);
  });
}

/**
 * Find a book by the title of a saved page. Returns the best candidate only if
 * it is similar enough to the page title, so non-book pages (articles, repos)
 * never get a wrong cover or title. `accept` further vets a candidate (e.g.
 * author evidence for pages that are not on a book site).
 */
export async function lookupByTitle(
  pageTitle: string,
  deps: LookupDeps = {},
  accept?: (book: BookInfo) => boolean
): Promise<BookInfo | null> {
  const title = cleanPageTitle(pageTitle);
  if (!title) return null;
  const found = await search({ q: `intitle:${title}` }, deps);
  let best: { book: BookInfo; score: number } | null = null;
  for (const book of found) {
    if (accept && !accept(book)) continue;
    const score = titleSimilarity(title, book);
    if (!best || score > best.score) best = { book, score };
  }
  if (!best || best.score < MIN_TITLE_SIMILARITY) return null;
  return betterCover(best.book, deps.fetch ?? fetch);
}

const surname = (a: string) =>
  a.trim().split(/\s+/).pop()?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? "";

/**
 * Confirm a book the AI named: the best candidate must have a similar title and,
 * when an author was given, share that author's surname. Null when nothing fits.
 */
export async function confirmBook(
  title: string,
  author: string | null,
  deps: LookupDeps = {}
): Promise<BookInfo | null> {
  const t = cleanPageTitle(title);
  if (!t) return null;
  const found = await search(
    {
      q: `intitle:${t}${author ? ` inauthor:${author}` : ""}`,
      plain: `${t} ${author ?? ""}`.trim(),
    },
    deps
  );
  const wanted = author ? surname(author) : "";
  let best: { book: BookInfo; score: number } | null = null;
  for (const book of found) {
    if (wanted.length >= 3 && !book.authors.some((a) => surname(a) === wanted)) continue;
    const score = titleSimilarity(t, book);
    if (!best || score > best.score) best = { book, score };
  }
  if (!best || best.score < MIN_TITLE_SIMILARITY) return null;
  return betterCover(best.book, deps.fetch ?? fetch);
}
