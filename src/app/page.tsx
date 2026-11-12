import { getFeedBlips } from "@/actions/blips";
import { BlipCard } from "@/components/blip-card";
import { listSpaces } from "@/actions/spaces";
import { buildFeedSections } from "@/lib/feed-groups";
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
  const sections = buildFeedSections(blips);
  const spaces = await listSpaces();

  return (
    <div className="container mx-auto max-w-2xl px-8 py-8">
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
        <div className="flex flex-col gap-3">
          {sections.map((section) =>
            section.type === "single" ? (
              <BlipCard key={section.blip.id} blip={section.blip} spaces={spaces} />
            ) : (
              <section
                key={section.groupId}
                className="rounded-xl border bg-muted/30 p-3"
              >
                <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  {section.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {section.blips.length} related
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {section.blips.map((blip) => (
                    <BlipCard key={blip.id} blip={blip} spaces={spaces} />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}
