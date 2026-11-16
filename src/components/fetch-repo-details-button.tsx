"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMissingRepoDetails } from "@/actions/repos";

export function FetchRepoDetailsButton({
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
          const r = await fetchMissingRepoDetails(spaceId);
          if (r.deferred > 0) {
            toast.error(
              `Found ${r.found} of ${r.attempted}. The code host is busy or rate limiting; try again in a bit.`
            );
          } else toast.success(`Found ${r.found} of ${r.attempted}`);
          router.refresh();
        })
      }
    >
      <RefreshCw className="size-4" />
      {isPending ? "Looking up…" : `Look up ${missing} more`}
    </Button>
  );
}
