"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reprocessLinkBlips } from "@/actions/capture";

export function ReprocessButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `Re-fetch previews and re-run AI on ${count} link blip${count === 1 ? "" : "s"}? ` +
        "This overwrites their titles, summaries and groups, including any edits you made."
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await reprocessLinkBlips();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      for (const w of result.warnings) toast.warning(w);
      toast.success(
        `Reprocessed ${result.updated} blip${result.updated === 1 ? "" : "s"}` +
          (result.groups ? `, ${result.groups} new group${result.groups === 1 ? "" : "s"}` : "")
      );
      router.push("/");
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending || count === 0}
    >
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      {isPending ? "Reprocessing…" : `Reprocess ${count} existing link blip${count === 1 ? "" : "s"}`}
    </Button>
  );
}
