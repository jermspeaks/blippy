"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Play, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unstoreBlip } from "@/actions/spaces";
import { setBlipFizzled } from "@/actions/blips";
import { formatAdded } from "@/lib/space-sort";
import { parseVideoUrl } from "@/lib/video";
import type { Blip } from "@/db/schema";
import { routedByNote } from "@/components/stored-blip-item";

export function VideoCard({
  blip,
  spaceId,
  groupLabel,
}: {
  blip: Blip;
  spaceId: string;
  groupLabel: string | null;
}) {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [isPending, startTransition] = useTransition();
  const video = parseVideoUrl(blip.url);
  const heading = blip.title ?? blip.content.slice(0, 120);
  // Shorts are portrait; everything else is 16:9.
  const portrait = !!blip.url && /\/shorts\//.test(blip.url);
  const aspect = portrait ? "aspect-[9/16]" : "aspect-video";

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
    <article className="bg-card mb-4 break-inside-avoid overflow-hidden rounded-xl border">
      {video && (
        <div className={`relative w-full bg-black ${aspect}`}>
          {playing ? (
            <iframe
              src={video.embedUrl}
              title={heading}
              className="absolute inset-0 size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${heading}`}
              className="group absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.thumbnailUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/70 text-white">
                  <Play className="size-5 fill-current" />
                </span>
              </span>
            </button>
          )}
        </div>
      )}
      <div className="space-y-1 p-3">
        <Link
          href={`/blips/${blip.id}`}
          className="line-clamp-2 font-medium hover:underline"
        >
          {heading}
        </Link>
        {blip.summary && (
          <p className="text-muted-foreground line-clamp-3 text-sm">
            {blip.summary}
          </p>
        )}
        {(groupLabel || blip.routedBy === "ai") && (
          <p
            className="text-muted-foreground text-xs"
            title={blip.routedReason ?? undefined}
          >
            {groupLabel}
            {groupLabel && blip.routedBy === "ai" ? " · " : ""}
            {blip.routedBy === "ai"
              ? routedByNote("ai").replace(/ · $/, "")
              : ""}
          </p>
        )}
        <p className="text-muted-foreground text-xs" suppressHydrationWarning>
          Added {formatAdded(blip.createdAt)}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
          {blip.url && (
            <a
              href={video?.watchUrl ?? blip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
              title="If the video won't play here, the uploader may have disabled embedding"
            >
              <ExternalLink className="size-3" />
              Open on YouTube
            </a>
          )}
          <div className="flex gap-1">
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
        </div>
      </div>
    </article>
  );
}
