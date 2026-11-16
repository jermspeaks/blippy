import Link from "next/link";
import { listReadingItems, readingCounts } from "@/actions/reading";
import { readingStatuses, type ReadingStatus } from "@/db/schema";
import { AddReadingLink } from "@/components/add-reading-link";
import { ReadingTable } from "@/components/reading-table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const labels: Record<ReadingStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  archived: "Archived",
};

const empty: Record<ReadingStatus, string> = {
  unread: "Nothing waiting. Use Read later on a blip, or paste a link above.",
  reading: "Nothing in progress.",
  read: "Nothing read yet.",
  archived: "Nothing archived.",
};

export default async function ReadingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const raw = (await searchParams).status;
  const status = (readingStatuses as readonly string[]).includes(raw ?? "")
    ? (raw as ReadingStatus)
    : "unread";
  const [items, counts] = await Promise.all([listReadingItems(status), readingCounts()]);

  return (
    <div className="container mx-auto max-w-5xl px-8 py-8">
      <h1 className="mb-4 text-2xl font-semibold">Reading</h1>
      <div className="mb-6">
        <AddReadingLink />
      </div>
      <nav className="mb-4 flex gap-1 border-b" aria-label="Reading status">
        {readingStatuses.map((s) => (
          <Link
            key={s}
            href={s === "unread" ? "/reading" : `/reading?status=${s}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              s === status
                ? "border-primary font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {labels[s]}{" "}
            <span className="text-muted-foreground text-xs tabular-nums">{counts[s]}</span>
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{empty[status]}</p>
      ) : (
        <ReadingTable items={items} />
      )}
    </div>
  );
}
