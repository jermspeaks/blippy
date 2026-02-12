"use client";

import Link from "next/link";
import type { Blip } from "@/db/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { snoozeBlip, setBlipFizzled } from "@/actions/blips";
import { CalendarClock, X, ExternalLink } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

export function BlipCard({ blip }: { blip: Blip }) {
  const [isPending, startTransition] = useTransition();

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <Link
          href={`/blips/${blip.id}`}
          className="font-medium text-primary hover:underline"
        >
          {blip.content.length > 120
            ? `${blip.content.slice(0, 120)}…`
            : blip.content}
        </Link>
      </CardHeader>
      <CardContent className="pb-2">
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
    </Card>
  );
}
