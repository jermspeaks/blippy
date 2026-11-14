import Link from "next/link";
import { listSpacesWithCounts } from "@/actions/spaces";
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

export default async function SpacesPage() {
  const spaces = await listSpacesWithCounts();

  return (
    <div className="container mx-auto max-w-4xl px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Spaces</h1>
          <p className="text-muted-foreground">
            Places to keep blips that have found a home. Stored blips leave the feed.
          </p>
        </div>
        <SpaceCreateDialog />
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
              <TableHead>Auto-intake</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((space) => (
              <TableRow key={space.id}>
                <TableCell className="font-medium">
                  <Link href={`/spaces/${space.id}`} className="hover:underline">
                    {space.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">{space.kind}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {space.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">{space.blipCount}</TableCell>
                <TableCell className="text-right tabular-nums">{space.groupCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {space.autoIntake ? "On" : "Off"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
