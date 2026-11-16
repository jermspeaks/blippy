"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToReadingList } from "@/actions/reading";

/** "Read later" on a blip; once saved it becomes a link to the reading item. */
export function ReadLaterButton({
  blipId,
  readingItemId,
  variant = "outline",
}: {
  blipId: string;
  readingItemId?: string | null;
  variant?: "outline" | "ghost";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (readingItemId) {
    return (
      <Button variant={variant} size="sm" asChild>
        <Link href={`/reading/${readingItemId}`} className="inline-flex items-center gap-1">
          <BookmarkCheck className="size-3" />
          In reading list
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={isPending}
      className="inline-flex items-center gap-1"
      onClick={() =>
        startTransition(async () => {
          const r = await addToReadingList(blipId);
          if (!r.ok) toast.error(r.error);
          else if (r.extracted) toast.success("Added to your reading list");
          else toast.warning("Added, but the article text couldn't be saved. Open it in Reading to retry.");
          router.refresh();
        })
      }
    >
      <BookmarkPlus className="size-3" />
      {isPending ? "Saving…" : "Read later"}
    </Button>
  );
}
