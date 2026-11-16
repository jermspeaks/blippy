"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeFromReadingList } from "@/actions/reading";

/** Confirm before deleting a saved article. The blip it came from is kept. */
export function RemoveReadingDialog({
  id,
  title,
  open,
  onOpenChange,
  onRemoved,
}: {
  id: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) onOpenChange(o);
        if (!o) setError(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete saved article?</DialogTitle>
          <DialogDescription>
            &ldquo;{title}&rdquo; and its saved text will be permanently deleted from your reading
            list. The blip it came from stays where it is, and you can add the link again later.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeFromReadingList(id);
                if (r.ok) {
                  toast.success("Deleted from your reading list");
                  onOpenChange(false);
                  onRemoved();
                } else setError("Couldn't delete it. Try again.");
              })
            }
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
