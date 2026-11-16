"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMissingBookDetails } from "@/actions/books";

export function FetchBookDetailsButton({
  spaceId,
  missing,
}: {
  spaceId: string;
  missing: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  if (missing === 0) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const r = await fetchMissingBookDetails(spaceId);
          toast.success(`Found ${r.found} of ${r.attempted}`);
          router.refresh();
        })
      }
    >
      <RefreshCw className="size-4" />
      {isPending ? "Looking up…" : `Look up ${missing} more`}
    </Button>
  );
}
