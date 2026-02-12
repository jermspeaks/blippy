import { getFeedBlips } from "@/actions/blips";
import { BlipCard } from "@/components/blip-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const blips = await getFeedBlips(categoryId ?? null);

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feed</h1>
        <Button asChild size="sm">
          <Link href="/capture" className="inline-flex items-center gap-2">
            <PlusCircle className="size-4" />
            Capture
          </Link>
        </Button>
      </div>
      {blips.length === 0 ? (
        <p className="text-muted-foreground">
          No blips due for review. Add one from Capture or check back later.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {blips.map((blip) => (
            <li key={blip.id}>
              <BlipCard blip={blip} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
