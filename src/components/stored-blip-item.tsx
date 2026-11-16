"use client";

import { ReadLaterButton } from "@/components/read-later-button";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unstoreBlip } from "@/actions/spaces";
import { setBlipFizzled } from "@/actions/blips";
import { formatAdded } from "@/lib/space-sort";
import type { Blip } from "@/db/schema";

export function routedByNote(r: Blip["routedBy"]) {
  if (r === "ai") return "Auto-sorted by AI · ";
  if (r === "group") return "Auto-sorted by topic · ";
  if (r === "rule") return "Auto-sorted by rule · ";
  return "";
}

export function StoredBlipItem({
  blip,
  spaceId,
  groupLabel,
  readingItemId = null,
}: {
  blip: Blip;
  spaceId: string;
  groupLabel: string | null;
  readingItemId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const heading = blip.title ?? blip.content.slice(0, 120);

  function handleReturn() {
    startTransition(async () => {
      await unstoreBlip(blip.id, spaceId);
      toast.success("Returned to feed");
      router.refresh();
    });
  }

  function handleFizzle() {
    startTransition(async () => {
      const r = await setBlipFizzled(blip.id);
      if (r.ok) toast.success("Blip fizzled");
      else toast.error("Failed to fizzle");
      router.refresh();
    });
  }

  return (
    <li className="flex gap-3 rounded-lg border p-3">
      {blip.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blip.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-16 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        {blip.url ? (
          <a
            href={blip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium hover:underline"
          >
            {heading}
          </a>
        ) : (
          <Link
            href={`/blips/${blip.id}`}
            className="text-primary font-medium hover:underline"
          >
            {heading}
          </Link>
        )}
        {blip.summary && <p className="mt-1 text-sm">{blip.summary}</p>}
        <p className="text-muted-foreground mt-1 text-xs">
          {groupLabel ? `${groupLabel} · ` : ""}
          <span title={blip.routedReason ?? undefined}>
            {routedByNote(blip.routedBy)}
          </span>
          <Link href={`/blips/${blip.id}`} className="underline">
            Open
          </Link>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <div className="flex gap-1">
          {blip.url && (
            <ReadLaterButton blipId={blip.id} readingItemId={readingItemId} variant="ghost" />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReturn}
            disabled={isPending}
          >
            <Undo2 className="size-3" />
            Return to feed
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFizzle}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
          >
            <X className="size-3" />
            Fizzle
          </Button>
        </div>
        <span
          className="text-muted-foreground text-xs"
          suppressHydrationWarning
        >
          Added {formatAdded(blip.createdAt)}
        </span>
      </div>
    </li>
  );
}
