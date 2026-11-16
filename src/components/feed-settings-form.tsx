"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFeedCap } from "@/actions/settings";

export function FeedSettingsForm({ cap }: { cap: number }) {
  const [value, setValue] = useState(String(cap));
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveFeedCap(Number(value));
          if (r.ok) toast.success("Feed limit saved");
          else toast.error(r.error);
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="feed-cap">Blips shown in the feed</Label>
        <Input
          id="feed-cap"
          type="number"
          min={5}
          max={200}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28"
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending || Number(value) === cap}>
        Save
      </Button>
    </form>
  );
}
