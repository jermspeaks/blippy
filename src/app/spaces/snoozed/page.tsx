import Link from "next/link";
import { listSnoozedBlips } from "@/actions/blips";
import { SnoozedBlipItem } from "@/components/snoozed-blip-item";

export const dynamic = "force-dynamic";

export default async function SnoozedPage() {
  const blips = await listSnoozedBlips();

  return (
    <div className="container mx-auto max-w-4xl px-8 py-8">
      <p className="mb-2 text-sm">
        <Link href="/spaces" className="text-muted-foreground hover:underline">
          ← Spaces
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Snoozed</h1>
      <p className="text-muted-foreground mb-6">
        Blips hidden from the feed until their review date. Unsnooze one to
        bring it back now.
      </p>
      {blips.length === 0 ? (
        <p className="text-muted-foreground">Nothing is snoozed.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blips.map((b) => (
            <SnoozedBlipItem key={b.id} blip={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
