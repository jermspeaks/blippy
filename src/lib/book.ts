export type BookProvider =
  | "goodreads"
  | "amazon"
  | "bookshop"
  | "openlibrary"
  | "simonandschuster"
  | "penguinrandomhouse"
  | "hachette"
  | "harpercollins"
  | "macmillan";

export type BookRef = { provider: BookProvider; isbn13: string | null };

const digits = (s: string) => s.replace(/[\s-]/g, "");

export function isValidIsbn13(raw: string): boolean {
  const s = digits(raw);
  if (!/^\d{13}$/.test(s)) return false;
  const sum = [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

export function isValidIsbn10(raw: string): boolean {
  const s = digits(raw).toUpperCase();
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  const sum = [...s].reduce((a, c, i) => a + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
  return sum % 11 === 0;
}

/** Normalize an ISBN-10 or ISBN-13 (hyphens/spaces allowed) to a valid ISBN-13, else null. */
export function toIsbn13(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = digits(raw).toUpperCase();
  if (isValidIsbn13(s)) return s;
  if (!isValidIsbn10(s)) return null;
  const core = `978${s.slice(0, 9)}`;
  const sum = [...core].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/**
 * Recognize a book link. Amazon only counts when the /dp/ id is a valid ISBN-10
 * (other ASINs are any product, not necessarily books). Returns the ISBN-13 when
 * the URL carries one; otherwise the caller finds the book by title.
 */
export function parseBookUrl(raw: string | null | undefined): BookRef | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname;

  if (host === "goodreads.com") {
    return /^\/book\/show\/\d+/.test(path) ? { provider: "goodreads", isbn13: null } : null;
  }
  if (/^amazon\.[a-z.]+$/.test(host)) {
    const m = path.match(/\/(?:dp|gp\/product)\/([0-9X]{10})(?:[/?]|$)/i);
    const isbn13 = m ? toIsbn13(m[1]) : null;
    return isbn13 ? { provider: "amazon", isbn13 } : null;
  }
  if (host === "bookshop.org") {
    const m = path.match(/^\/(?:p\/)?books\/[^/]+\/(\d{13})\/?$/);
    if (m) return { provider: "bookshop", isbn13: toIsbn13(m[1]) };
    return /^\/p\/books\//.test(path) ? { provider: "bookshop", isbn13: null } : null;
  }
  if (host === "openlibrary.org") {
    const isbn = path.match(/^\/isbn\/([0-9Xx-]+)\/?$/);
    if (isbn) return { provider: "openlibrary", isbn13: toIsbn13(isbn[1]) };
    return /^\/(?:books|works)\/OL\d+[MW]/i.test(path)
      ? { provider: "openlibrary", isbn13: null }
      : null;
  }
  if (host === "simonandschuster.com") {
    const m = path.match(/^\/books\/[^/]+\/[^/]+\/(\d{13})\/?$/);
    return m ? { provider: "simonandschuster", isbn13: toIsbn13(m[1]) } : null;
  }
  if (host === "penguinrandomhouse.com") {
    return /^\/books\/\d+\//.test(path) ? { provider: "penguinrandomhouse", isbn13: null } : null;
  }
  if (host === "hachettebookgroup.com") {
    const m = path.match(/^\/titles\/[^/]+\/[^/]+\/(\d{13})\/?$/);
    return m ? { provider: "hachette", isbn13: toIsbn13(m[1]) } : null;
  }
  if (host === "harpercollins.com") {
    // Product slugs carry no ISBN (the ?variant id is a shop id), so the book is found by title.
    return /^\/products\/[^/]+\/?$/.test(path) ? { provider: "harpercollins", isbn13: null } : null;
  }
  if (host === "macmillan.com" || host.endsWith(".macmillan.com")) {
    const m = path.match(/^\/books\/(\d{13})(?:\/|$)/);
    return m ? { provider: "macmillan", isbn13: toIsbn13(m[1]) } : null;
  }
  return null;
}

export const isBookUrl = (url: string | null | undefined) => parseBookUrl(url) !== null;
