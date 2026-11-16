"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addUrlToReadingList } from "@/actions/reading";

export function AddReadingLink() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await addUrlToReadingList(url);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setUrl("");
      if (r.extracted) toast.success("Added to your reading list");
      else toast.warning("Added, but the article text couldn't be saved. Open it to retry.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl gap-2">
      <Input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste an article link to read later"
        aria-label="Article link"
        disabled={isPending}
      />
      <Button type="submit" size="sm" disabled={isPending || !url.trim()} className="shrink-0">
        <Plus className="size-4" />
        {isPending ? "Saving…" : "Add"}
      </Button>
    </form>
  );
}
