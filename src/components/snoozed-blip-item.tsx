"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unsnoozeBlip } from "@/actions/blips";
import type { Blip } from "@/db/schema";

export function SnoozedBlipItem({ blip }: { blip: Blip }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const heading = blip.title ?? blip.content.slice(0, 120);

  function handleUnsnooze() {
    startTransition(async () => {
      await unsnoozeBlip(blip.id);
      toast.success("Back in the feed");
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3">
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
        {blip.summary && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {blip.summary}
          </p>
        )}
        <p
          className="text-muted-foreground mt-1 text-xs"
          suppressHydrationWarning
        >
          Returns to the feed {blip.nextReviewAt?.toLocaleDateString()}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnsnooze}
        disabled={isPending}
      >
        <Bell className="size-3" />
        Unsnooze
      </Button>
    </li>
  );
}
