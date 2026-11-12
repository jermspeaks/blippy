"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unstoreBlip } from "@/actions/spaces";
import type { Blip } from "@/db/schema";

export function StoredBlipItem({
  blip,
  spaceId,
  groupLabel,
}: {
  blip: Blip;
  spaceId: string;
  groupLabel: string | null;
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
            className="font-medium text-primary hover:underline"
          >
            {heading}
          </a>
        ) : (
          <Link href={`/blips/${blip.id}`} className="font-medium text-primary hover:underline">
            {heading}
          </Link>
        )}
        {blip.summary && <p className="mt-1 text-sm">{blip.summary}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {groupLabel ? `${groupLabel} · ` : ""}
          <Link href={`/blips/${blip.id}`} className="underline">
            Open
          </Link>
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleReturn}
        disabled={isPending}
        className="self-start"
      >
        <Undo2 className="size-3" />
        Return to feed
      </Button>
    </li>
  );
}
