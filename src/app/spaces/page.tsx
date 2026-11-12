import Link from "next/link";
import { listSpacesWithCounts } from "@/actions/spaces";
import { SpaceCreateForm } from "@/components/space-create-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const spaces = await listSpacesWithCounts();

  return (
    <div className="container mx-auto max-w-2xl px-8 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Spaces</h1>
      <p className="mb-6 text-muted-foreground">
        Places to keep blips that have found a home. Stored blips leave the feed.
      </p>
      <div className="mb-8">
        <SpaceCreateForm />
      </div>
      {spaces.length === 0 ? (
        <p className="text-muted-foreground">No spaces yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link href={`/spaces/${space.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader className="pb-1 font-medium">{space.name}</CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {space.description && <p>{space.description}</p>}
                    <p>
                      {space.blipCount} blip{space.blipCount === 1 ? "" : "s"} ·{" "}
                      {space.groupCount} linked group{space.groupCount === 1 ? "" : "s"} ·{" "}
                      auto-intake {space.autoIntake ? "on" : "off"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
