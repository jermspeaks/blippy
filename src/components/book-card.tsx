"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, ExternalLink, RefreshCw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unstoreBlip } from "@/actions/spaces";
import { setBlipFizzled } from "@/actions/blips";
import { refreshBook } from "@/actions/books";
import type { Blip, BookDetails } from "@/db/schema";
import { routedByNote } from "@/components/stored-blip-item";

export function parseAuthors(raw: string | undefined): string[] {
  try {
    const a = JSON.parse(raw ?? "[]");
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function BookCard({
  blip,
  book,
  spaceId,
}: {
  blip: Blip;
  book: BookDetails | null;
  spaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [coverFailed, setCoverFailed] = useState(false);
  const heading = blip.title ?? blip.content.slice(0, 120);
  const authors = parseAuthors(book?.authors);
  const showCover = blip.imageUrl && !coverFailed;
  const meta = [book?.publishedYear, book?.publisher].filter(Boolean).join(" · ");
  const unmatched = !book || book.lookupStatus === "failed";

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const handleReturn = () =>
    run(async () => {
      await unstoreBlip(blip.id, spaceId);
      toast.success("Returned to feed");
    });
  const handleFizzle = () =>
    run(async () => {
      const r = await setBlipFizzled(blip.id);
      if (r.ok) toast.success("Blip fizzled");
      else toast.error("Failed to fizzle");
    });
  const handleRefresh = () =>
    run(async () => {
      const r = await refreshBook(blip.id);
      if (!r.ok) toast.error(r.error);
      else if (r.found) toast.success("Book details updated");
      else toast.error("No matching book found");
    });

  return (
    <article className="bg-card mb-4 break-inside-avoid overflow-hidden rounded-xl border">
      {showCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blip.imageUrl!}
          alt={`Cover of ${heading}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setCoverFailed(true)}
          className="bg-muted h-auto w-full"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 p-4 text-center">
          <BookOpen className="size-8" />
          <span className="line-clamp-4 text-sm font-medium">{heading}</span>
        </div>
      )}
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 leading-snug font-medium">{heading}</h3>
        {authors.length > 0 && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {authors.join(", ")}
          </p>
        )}
        {meta && <p className="text-muted-foreground text-xs">{meta}</p>}
        {(unmatched || book?.lookupStatus === "partial" || blip.routedBy) && (
          <p
            className="text-muted-foreground text-xs"
            title={blip.routedReason ?? undefined}
          >
            {unmatched
              ? "No book details found"
              : book?.lookupStatus === "partial"
                ? "Matched by title"
                : ""}
            {unmatched || book?.lookupStatus === "partial" ? " · " : ""}
            {routedByNote(blip.routedBy).replace(/ · $/, "")}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
          {blip.url && (
            <a
              href={blip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          )}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
              aria-label="Look up book details again"
              title="Look up book details again"
            >
              <RefreshCw className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReturn}
              disabled={isPending}
              aria-label="Return to feed"
              title="Return to feed"
            >
              <Undo2 className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFizzle}
              disabled={isPending}
              aria-label="Fizzle"
              title="Fizzle"
              className="text-destructive hover:text-destructive"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
