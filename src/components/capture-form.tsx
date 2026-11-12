"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importMarkdown } from "@/actions/capture";

export function CaptureForm() {
  const router = useRouter();
  const [markdown, setMarkdown] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await importMarkdown(markdown);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      for (const w of result.warnings) toast.warning(w);
      const dupes = result.skippedDuplicates
        ? `, ${result.skippedDuplicates} already existed`
        : "";
      const stored = result.storedInSpaces
        ? `, ${result.storedInSpaces} stored in spaces`
        : "";
      toast.success(
        `Created ${result.created} blip${result.created === 1 ? "" : "s"}${stored}${dupes}`
      );
      if (result.created > 0) {
        setMarkdown("");
        router.push("/");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder={"[Article title](https://example.com/post)\n\n- [Related link](https://example.com/other)"}
        className="min-h-[55vh] font-mono text-sm"
        disabled={isPending}
        aria-label="Daily notes (markdown)"
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Up to 50 links per import. Link previews are fetched, then AI writes
          summaries and groups related links.
        </p>
        <Button type="submit" disabled={isPending || !markdown.trim()}>
          <Sparkles className="size-4" />
          {isPending ? "Processing…" : "Create blips"}
        </Button>
      </div>
    </form>
  );
}
