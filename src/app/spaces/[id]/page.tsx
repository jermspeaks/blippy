import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceDetail } from "@/actions/spaces";
import { SpaceManager } from "@/components/space-manager";
import { VideoCard } from "@/components/video-card";
import { StoredBlipItem } from "@/components/stored-blip-item";

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSpaceDetail(id);
  if (!detail) notFound();
  const { space, blips, linkedGroups, availableGroups } = detail;

  return (
    <div
      className={`container mx-auto px-8 py-8 ${space.kind === "video" ? "max-w-7xl" : "max-w-2xl"}`}
    >
      <p className="mb-2 text-sm">
        <Link href="/spaces" className="text-muted-foreground hover:underline">
          ← Spaces
        </Link>
      </p>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">{space.name}</h1>
          {space.description && <p className="text-muted-foreground">{space.description}</p>}
        </div>
        <SpaceManager
          space={space}
          linkedGroups={linkedGroups}
          availableGroups={availableGroups}
        />
      </div>
      <h2 className="mb-3 text-lg font-medium">
        Blips <span className="text-sm font-normal text-muted-foreground">({blips.length})</span>
      </h2>
      {blips.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing stored yet. Use Store on a feed card, or link a topic group in Settings.
        </p>
      ) : space.kind === "video" ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {blips.map((b) => (
            <VideoCard key={b.id} blip={b} spaceId={space.id} groupLabel={b.groupLabel} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blips.map((b) => (
            <StoredBlipItem key={b.id} blip={b} spaceId={space.id} groupLabel={b.groupLabel} />
          ))}
        </ul>
      )}
    </div>
  );
}
