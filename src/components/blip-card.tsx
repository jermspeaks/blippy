"use client";

import Link from "next/link";
import type { Blip } from "@/db/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { snoozeBlip, setBlipFizzled } from "@/actions/blips";
import { CalendarClock, X, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function BlipCard({ blip }: { blip: Blip }) {
  const [isPending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);

  function handleSnooze() {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    startTransition(async () => {
      const result = await snoozeBlip(blip.id, next);
      if (result.ok) toast.success("Snoozed until tomorrow");
      else toast.error("Failed to snooze");
    });
  }

  function handleFizzle() {
    startTransition(async () => {
      const result = await setBlipFizzled(blip.id);
      if (result.ok) toast.success("Blip fizzled");
      else toast.error("Failed to fizzle");
    });
  }

  const heading = blip.title ?? (blip.content.length > 120 ? `${blip.content.slice(0, 120)}…` : blip.content);
  const showImage = blip.imageUrl && !imageFailed;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {showImage && (
          // Remote OG images come from arbitrary hosts, so use a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blip.imageUrl!}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-40 w-full shrink-0 object-cover sm:h-auto sm:w-40"
          />
        )}
        <div className="min-w-0 flex-1">
          <CardHeader className="pb-2">
            {blip.url ? (
              <a
                href={blip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {heading}
              </a>
            ) : (
              <Link href={`/blips/${blip.id}`} className="font-medium text-primary hover:underline">
                {heading}
              </Link>
            )}
            {blip.url && (
              <p className="truncate text-xs text-muted-foreground">
                {blip.siteName ?? hostOf(blip.url)}
              </p>
            )}
          </CardHeader>
          <CardContent className="pb-2">
            {blip.summary && <p className="mb-2 text-sm">{blip.summary}</p>}
            <p className="text-sm text-muted-foreground">
              {blip.nextReviewAt
                ? `Review: ${blip.nextReviewAt.toLocaleDateString()}`
                : "No review date"}
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/blips/${blip.id}`} className="inline-flex items-center gap-1">
                <ExternalLink className="size-3" />
                Open
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSnooze}
              disabled={isPending}
              className="inline-flex items-center gap-1"
            >
              <CalendarClock className="size-3" />
              Snooze
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFizzle}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-destructive hover:text-destructive"
            >
              <X className="size-3" />
              Fizzle
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}
