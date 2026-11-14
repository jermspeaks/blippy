"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countRerouteCandidates, rerouteFeedBlips } from "@/actions/reroute";

type Router = ReturnType<typeof useRouter>;

const plural = (n: number) => `${n} blip${n === 1 ? "" : "s"}`;

/** Run a re-route and report what moved. Shared by the feed button and the auto-offer toast. */
export async function runReroute(router: Router) {
  const r = await rerouteFeedBlips();
  if (!r.ok) {
    toast.error(r.error);
    return;
  }
  for (const w of r.warnings) toast.warning(w);
  const parts = [
    r.byRule && `${r.byRule} by rule`,
    r.byGroup && `${r.byGroup} by topic`,
    r.byAi && `${r.byAi} by AI`,
  ].filter(Boolean);
  const more = r.remaining
    ? ` ${plural(r.remaining)} more were not checked; run it again.`
    : "";
  if (r.moved === 0) {
    toast.info(`No feed blips matched a space (${r.checked} checked).${more}`);
  } else {
    toast.success(
      `Moved ${r.moved} of ${r.checked} to spaces: ${parts.join(", ")}.${more}`,
      {
        action: { label: "View log", onClick: () => router.push("/routing") },
      }
    );
  }
  router.refresh();
}

/** After a new space or rule: offer to apply it to blips already in the feed. */
export async function offerReroute(router: Router) {
  const n = await countRerouteCandidates();
  if (n === 0) return;
  toast(`Re-route ${plural(n)} in your feed?`, {
    description: "Apply your new space or rule to blips already waiting.",
    duration: 12000,
    action: { label: "Re-route", onClick: () => void runReroute(router) },
  });
}

export function RerouteButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending || count === 0}
      onClick={() => startTransition(() => runReroute(router))}
      title="Re-check where these blips belong using your current spaces and rules. Titles and summaries are not changed."
    >
      <Shuffle className={isPending ? "size-4 animate-pulse" : "size-4"} />
      {isPending ? "Re-routing…" : `Re-route ${plural(count)}`}
    </Button>
  );
}
