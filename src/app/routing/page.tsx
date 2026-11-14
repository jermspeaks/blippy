import Link from "next/link";
import {
  listRoutingEvents,
  routingTotals,
  type RoutingFilter,
} from "@/actions/routing";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { key: RoutingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "group", label: "Topic group" },
  { key: "rule", label: "Link type" },
  { key: "inbox", label: "Left in feed" },
];
const HOW: Record<string, string> = {
  ai: "AI",
  group: "Topic group",
  rule: "Link type",
};

export default async function RoutingPage({
  searchParams,
}: {
  searchParams: Promise<{ how?: string }>;
}) {
  const { how } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === how)?.key ??
    "all") as RoutingFilter;
  const [events, totals] = await Promise.all([
    listRoutingEvents(filter),
    routingTotals(),
  ]);
  const total = totals.rule + totals.group + totals.ai + totals.inbox;

  return (
    <div className="container mx-auto max-w-5xl px-8 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Routing</h1>
      <p className="text-muted-foreground mb-4">
        Audit log of where each captured link went and why. Newest first, latest
        200 shown.
      </p>
      <p className="text-muted-foreground mb-4 text-sm">
        {total} decisions: {totals.ai} AI · {totals.group} topic group ·{" "}
        {totals.rule} link type · {totals.inbox} left in feed
      </p>
      <nav className="mb-4 flex gap-1" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/routing" : `/routing?how=${f.key}`}
            className={cn(
              "rounded-md border px-3 py-1 text-sm",
              filter === f.key
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {events.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing logged yet. Decisions appear here after a capture or
          reprocess.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>When</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Went to</TableHead>
              <TableHead>How</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {e.createdAt.toLocaleString()}
                  {e.source === "reprocess" && " (reprocess)"}
                </TableCell>
                <TableCell className="max-w-xs truncate font-medium">
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {e.blipTitle}
                    </a>
                  ) : (
                    e.blipTitle
                  )}
                </TableCell>
                <TableCell>
                  {e.spaceId ? (
                    <Link
                      href={`/spaces/${e.spaceId}`}
                      className="hover:underline"
                    >
                      {e.spaceName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Feed</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.routedBy ? HOW[e.routedBy] : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-sm">
                  {e.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
