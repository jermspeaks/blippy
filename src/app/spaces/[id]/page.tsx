import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceDetail } from "@/actions/spaces";
import { SpaceManager } from "@/components/space-manager";
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
    <div className="container mx-auto max-w-2xl px-8 py-8">
      <p className="mb-2 text-sm">
        <Link href="/spaces" className="text-muted-foreground hover:underline">
          ← Spaces
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">{space.name}</h1>
      {space.description && (
        <p className="mb-6 text-muted-foreground">{space.description}</p>
      )}
      <div className="mb-8">
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
          Nothing stored yet. Use Store on a feed card, or link a topic group above.
        </p>
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
