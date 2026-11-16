"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Check, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryExtraction, setReadingStatus } from "@/actions/reading";
import { RemoveReadingDialog } from "@/components/remove-reading-dialog";
import type { ReadingStatus } from "@/db/schema";

export function ReaderActions({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: ReadingStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function setStatus(next: ReadingStatus, message: string) {
    startTransition(async () => {
      const r = await setReadingStatus(id, next);
      if (r.ok) toast.success(message);
      else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "read" || status === "archived" ? (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setStatus("unread", "Moved back to Unread")}>
          <RotateCcw className="size-3" />
          Mark unread
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setStatus("read", "Marked as read")}>
          <Check className="size-3" />
          Mark read
        </Button>
      )}
      {status !== "archived" && (
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => setStatus("archived", "Archived")}>
          <Archive className="size-3" />
          Archive
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await retryExtraction(id);
            if (r.ok) toast.success("Article text refreshed");
            else toast.error(r.error);
            router.refresh();
          })
        }
        title="Fetch the page again"
      >
        <RefreshCw className="size-3" />
        Refresh text
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3" />
        Delete
      </Button>
      <RemoveReadingDialog
        id={id}
        title={title}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onRemoved={() => router.push("/reading")}
      />
    </div>
  );
}
