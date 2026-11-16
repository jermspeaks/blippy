import { parseBookUrl } from "@/lib/book";
import { confirmBook, type BookInfo } from "@/lib/book-lookup";

export const AI_BOOK_REASON = "Book (named by AI, confirmed in book databases)";

const CONCURRENCY = 2;

/**
 * Pages whose URL does not identify a book, but which the AI says are about one
 * specific book. Each is checked once against the book databases; only a
 * confirmed match counts, so a hallucinated or too-recent title stays out of
 * the book space. A lookup error means "not confirmed". Keys are caller ids.
 */
export async function confirmAiBooks(
  items: { key: string; url: string | null; book: { title: string; author: string | null } | null }[]
): Promise<Map<string, BookInfo>> {
  const todo = items.filter((i) => i.book && !parseBookUrl(i.url));
  const out = new Map<string, BookInfo>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
      while (next < todo.length) {
        const i = todo[next++];
        try {
          const info = await confirmBook(i.book!.title, i.book!.author);
          if (info) out.set(i.key, info);
        } catch (err) {
          console.error("Book confirm failed", err instanceof Error ? err.message : err);
        }
      }
    })
  );
  return out;
}
