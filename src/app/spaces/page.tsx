import Link from "next/link";
import { listSpacesWithCounts } from "@/actions/spaces";
import { SortDialog } from "@/components/sort-dialog";
import { formatAdded } from "@/lib/space-sort";
import {
  parseSpacesListSort,
  sortSpaces,
  spacesListSortLabels,
} from "@/lib/spaces-list-sort";
import { SpaceCreateDialog } from "@/components/space-create-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SpacesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sort = parseSpacesListSort((await searchParams).sort);
  const spaces = sortSpaces(await listSpacesWithCounts(), sort);

  return (
    <div className="container mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Spaces</h1>
          <p className="text-muted-foreground">
            Places to keep blips that have found a home. Stored blips leave the
            feed.
          </p>
        </div>
        <div className="flex gap-2">
          <SortDialog
            current={sort}
            options={spacesListSortLabels}
            defaultValue="name-asc"
            title="Sort spaces"
          />
          <SpaceCreateDialog />
        </div>
      </div>
      {spaces.length === 0 ? (
        <p className="text-muted-foreground">No spaces yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Blips</TableHead>
              <TableHead className="text-right">Groups</TableHead>
              <TableHead>Last added</TableHead>
              <TableHead>Auto-intake</TableHead>
              <TableHead>AI routing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((space) => (
              <TableRow key={space.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/spaces/${space.id}`}
                    className="hover:underline"
                  >
                    {space.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {space.kind}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {space.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {space.blipCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {space.groupCount}
                </TableCell>
                <TableCell
                  className="text-muted-foreground whitespace-nowrap"
                  suppressHydrationWarning
                >
                  {space.lastAddedAt ? formatAdded(space.lastAddedAt) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {space.autoIntake ? "On" : "Off"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {space.kind === "general"
                    ? space.aiRouting
                      ? "On"
                      : "Off"
                    : "n/a"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
