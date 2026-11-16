"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addBook, searchBookCandidates } from "@/actions/books";
import type { BookInfo } from "@/lib/book-lookup";

export function AddBookDialog({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookInfo[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await searchBookCandidates(query);
      setResults(r.books);
    });
  }

  function handleAdd(book: BookInfo) {
    startTransition(async () => {
      const r = await addBook(spaceId, book);
      if (r.ok) {
        toast.success(`Added "${r.title}"`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
          setResults(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
          <DialogDescription>
            Search by title, author or ISBN, then pick the edition to add.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Atomic Habits, or 9780735211292"
            aria-label="Book search"
          />
          <Button type="submit" disabled={isPending || !query.trim()}>
            <Search className="size-4" />
            Search
          </Button>
        </form>
        {results && results.length === 0 && (
          <p className="text-muted-foreground text-sm">No books found.</p>
        )}
        {results && results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((b, i) => (
              <li key={`${b.isbn13 ?? b.title}-${i}`}>
                <button
                  type="button"
                  onClick={() => handleAdd(b)}
                  disabled={isPending}
                  className="hover:bg-muted flex w-full gap-3 rounded-lg border p-2 text-left"
                >
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-20 w-14 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-20 w-14 shrink-0 rounded" />
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium">
                      {b.title}
                    </span>
                    <span className="text-muted-foreground line-clamp-1 block text-xs">
                      {b.authors.join(", ") || "Unknown author"}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {[b.publishedYear, b.publisher].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
