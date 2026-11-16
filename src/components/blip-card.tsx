"use client";

import Link from "next/link";
import type { Blip, Space } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { snoozeBlip, setBlipFizzled } from "@/actions/blips";
import { storeBlip, routeGroupToSpace } from "@/actions/spaces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, X, ExternalLink, Archive } from "lucide-react";
import { ReadLaterButton } from "@/components/read-later-button";
import { useState, useTransition } from "react";
import { toast } from "sonner";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function BlipCard({
  blip,
  spaces = [],
  readingItemId = null,
}: {
  blip: Blip;
  spaces?: Space[];
  readingItemId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [imageFailed, setImageFailed] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const selectedSpace = spaces.find((s) => String(s.id) === selectedSpaceId);

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

  function handleStore(space: Space) {
    startTransition(async () => {
      const result = await storeBlip(blip.id, space.id);
      if (result.ok) {
        setStoreOpen(false);
        const g = result.suggestGroup;
        if (g) {
          toast.success(`Stored in ${result.spaceName}`, {
            description: `Also file "${g.label}" here? Future links on this topic will route automatically.`,
            duration: 10000,
            action: {
              label: g.others ? `Link + move ${g.others} more` : "Link group",
              onClick: async () => {
                const r = await routeGroupToSpace(g.id, space.id);
                if (r.ok) toast.success(`Linked "${g.label}" to ${r.spaceName}`);
                else toast.error(r.error);
              },
            },
          });
        } else toast.success(`Stored in ${result.spaceName}`);
      } else toast.error(result.error);
    });
  }

  const heading = blip.title ?? (blip.content.length > 120 ? `${blip.content.slice(0, 120)}…` : blip.content);
  const showImage = blip.imageUrl && !imageFailed;

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex items-stretch gap-3 p-2.5">
        {showImage && (
          // Remote OG images come from arbitrary hosts, so use a plain <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blip.imageUrl!}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="hidden h-20 w-28 shrink-0 rounded-md object-cover sm:block"
          />
        )}
        <div className="min-w-0 flex-1">
          {blip.url ? (
            <a
              href={blip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-1 text-sm font-medium text-primary hover:underline"
            >
              {heading}
            </a>
          ) : (
            <Link
              href={`/blips/${blip.id}`}
              className="line-clamp-1 text-sm font-medium text-primary hover:underline"
            >
              {heading}
            </Link>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {[
              blip.url ? (blip.siteName ?? hostOf(blip.url)) : null,
              `Added ${blip.createdAt.toLocaleDateString()}`,
              blip.nextReviewAt
                ? `Review ${blip.nextReviewAt.toLocaleDateString()}`
                : "No review date",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {blip.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{blip.summary}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 self-center">
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
          {blip.url && <ReadLaterButton blipId={blip.id} readingItemId={readingItemId} />}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStoreOpen(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1"
          >
            <Archive className="size-3" />
            Store
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
        </div>
      </div>
      <Dialog open={storeOpen} onOpenChange={setStoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Store in a space</DialogTitle>
            <DialogDescription>
              Pick the space this fits best. It leaves the feed and lives there.
            </DialogDescription>
          </DialogHeader>
          {spaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no spaces yet.{" "}
              <Link href="/spaces" className="text-primary underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              <select
                aria-label="Space"
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Choose a space…</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              {selectedSpace?.description && (
                <p className="text-xs text-muted-foreground">{selectedSpace.description}</p>
              )}
              <Button
                size="sm"
                disabled={isPending || !selectedSpace}
                onClick={() => selectedSpace && handleStore(selectedSpace)}
              >
                <Archive className="size-4" />
                Store
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
