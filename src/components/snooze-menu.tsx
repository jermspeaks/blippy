"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { snoozeBlip } from "@/actions/blips";
import { addDays, parseDateInput, snoozePresets, toDateInput } from "@/lib/snooze";

const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Snooze button with quick choices (tomorrow, a week, a month) and a custom date. */
export function SnoozeMenu({
  blipId,
  label = "Snooze",
  onSnoozed,
}: {
  blipId: string;
  label?: string;
  onSnoozed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [isPending, startTransition] = useTransition();
  // Computed when opened so "tomorrow" is right even if the page has been open overnight.
  const [presets, setPresets] = useState(() => snoozePresets());
  const [minDate, setMinDate] = useState(() => toDateInput(addDays(new Date(), 1)));

  function snooze(date: Date) {
    startTransition(async () => {
      const r = await snoozeBlip(blipId, date);
      if (r.ok) {
        toast.success(`Snoozed until ${fmt(date)}`);
        setOpen(false);
        onSnoozed?.();
      } else toast.error(typeof r.error === "string" ? r.error : "Failed to snooze");
    });
  }

  const customDate = parseDateInput(custom);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPresets(snoozePresets());
          setMinDate(toDateInput(addDays(new Date(), 1)));
          setOpen(true);
        }}
        disabled={isPending}
        className="inline-flex items-center gap-1"
      >
        <CalendarClock className="size-3" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze until…</DialogTitle>
            <DialogDescription>
              The blip leaves the feed and comes back that morning. Snoozed blips are listed in Spaces.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                variant="outline"
                className="justify-between"
                disabled={isPending}
                onClick={() => snooze(p.date)}
              >
                <span>{p.label}</span>
                <span className="text-muted-foreground text-xs">{fmt(p.date)}</span>
              </Button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customDate) snooze(customDate);
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor={`snooze-date-${blipId}`}>Pick a date</Label>
              <Input
                id={`snooze-date-${blipId}`}
                type="date"
                min={minDate}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isPending || !customDate || custom < minDate}>
              Snooze
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
