import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceDetail } from "@/actions/spaces";
import { SpaceManager } from "@/components/space-manager";
import { SortDialog } from "@/components/sort-dialog";
import { parseSpaceSort, sortBlips, spaceSortLabels } from "@/lib/space-sort";
import { VideoCard } from "@/components/video-card";
import { StoredBlipItem } from "@/components/stored-blip-item";
import { BookCard } from "@/components/book-card";
import { RepoCard } from "@/components/repo-card";
import { FetchRepoDetailsButton } from "@/components/fetch-repo-details-button";
import { AddBookDialog } from "@/components/add-book-dialog";
import { FetchBookDetailsButton } from "@/components/fetch-book-details-button";

export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const sort = parseSpaceSort((await searchParams).sort);
  const detail = await getSpaceDetail(id);
  if (!detail) notFound();
  const { space, linkedGroups, availableGroups } = detail;
  const blips = sortBlips(detail.blips, sort);
  // Book blips that were never looked up (no details row).
  const missingDetails = blips.filter((b) => !b.book).length;
  const missingRepoDetails = blips.filter((b) => b.url && !b.repo).length;

  return (
    <div
      className={`container mx-auto px-8 py-8 ${space.kind === "general" ? "max-w-6xl" : "max-w-7xl"}`}
    >
      <p className="mb-2 text-sm">
        <Link href="/spaces" className="text-muted-foreground hover:underline">
          ← Spaces
        </Link>
      </p>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">{space.name}</h1>
          {space.description && (
            <p className="text-muted-foreground">{space.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {space.kind === "book" && (
            <>
              <FetchBookDetailsButton
                spaceId={space.id}
                missing={missingDetails}
              />
              <AddBookDialog spaceId={space.id} />
            </>
          )}
          {space.kind === "code" && (
            <FetchRepoDetailsButton spaceId={space.id} missing={missingRepoDetails} />
          )}
          <SortDialog
            current={sort}
            options={spaceSortLabels}
            defaultValue="newest"
            title="Sort blips"
          />
          <SpaceManager
            space={space}
            linkedGroups={linkedGroups}
            availableGroups={availableGroups}
          />
        </div>
      </div>
      <h2 className="mb-3 text-lg font-medium">
        Blips{" "}
        <span className="text-muted-foreground text-sm font-normal">
          ({blips.length})
        </span>
      </h2>
      {blips.length === 0 ? (
        <p className="text-muted-foreground">
          {space.kind === "book"
            ? "No books yet. Save a book link, or use Add book."
            : space.kind === "code"
              ? "No repositories yet. Save a GitHub, GitLab, Bitbucket or Codeberg repository link."
              : "Nothing stored yet. Use Store on a feed card, or link a topic group in Settings."}
        </p>
      ) : space.kind === "book" ? (
        <div className="columns-2 gap-4 md:columns-3 lg:columns-4 xl:columns-5">
          {blips.map((b) => (
            <BookCard key={b.id} blip={b} book={b.book} spaceId={space.id} />
          ))}
        </div>
      ) : space.kind === "code" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {blips.map((b) => (
            <RepoCard key={b.id} blip={b} repo={b.repo} spaceId={space.id} />
          ))}
        </div>
      ) : space.kind === "video" ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {blips.map((b) => (
            <VideoCard
              key={b.id}
              blip={b}
              spaceId={space.id}
              groupLabel={b.groupLabel}
            />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blips.map((b) => (
            <StoredBlipItem
              key={b.id}
              blip={b}
              spaceId={space.id}
              groupLabel={b.groupLabel}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
