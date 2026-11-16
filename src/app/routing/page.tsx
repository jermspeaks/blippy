import Link from "next/link";
import {
  listRoutingEvents,
  listRoutingRules,
  listSpaceRouting,
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
import { RoutingRules } from "@/components/routing-rules";
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { getAiConfig } from "@/actions/settings";

export const dynamic = "force-dynamic";

const FILTERS: { key: RoutingFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "group", label: "Topic group" },
  { key: "rule", label: "Rule" },
  { key: "inbox", label: "Left in feed" },
];
const HOW: Record<string, string> = {
  ai: "AI",
  group: "Topic group",
  rule: "Rule",
};

export default async function RoutingPage({
  searchParams,
}: {
  searchParams: Promise<{ how?: string }>;
}) {
  const { how } = await searchParams;
  const filter = (FILTERS.find((f) => f.key === how)?.key ??
    "all") as RoutingFilter;
  const [events, totals, rules, spaceRouting, config] = await Promise.all([
    listRoutingEvents(filter),
    routingTotals(),
    listRoutingRules(),
    listSpaceRouting(),
    getAiConfig(),
  ]);
  const total = totals.rule + totals.group + totals.ai + totals.inbox;

  return (
    <div className="container mx-auto max-w-5xl px-8 py-8">
      <h1 className="mb-1 text-2xl font-semibold">Routing</h1>
      <p className="text-muted-foreground mb-6">
        How captured links find a space, and a log of where each one went.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">How a link is routed</h2>
        <p className="text-muted-foreground mb-2 text-sm">
          The first step that matches wins. If none match, the link stays in the
          feed for you to triage.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            <strong>Domain rule</strong> (below): you chose a site → space
            mapping.
          </li>
          <li>
            <strong>Link type</strong>: YouTube links go to the Videos space; book links (Goodreads, Amazon, Bookshop, Open Library and publisher pages) go to the Books space.
          </li>
          <li>
            <strong>Topic group</strong>: the AI&apos;s topic group is linked to
            a space with auto-intake on.
          </li>
          <li>
            <strong>AI match</strong>: the AI picks a space from its name and
            description, only for spaces with auto-intake and AI routing on.
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Domain rules</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Links from a site always go to its space, ahead of everything else.
          Subdomains match too; add a path (e.g. github.com/vercel) to be more
          specific.
        </p>
        <RoutingRules
          rules={rules}
          spaces={spaceRouting.map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Spaces</h2>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Space</TableHead>
              <TableHead>Linked topic groups</TableHead>
              <TableHead>Auto-intake</TableHead>
              <TableHead>AI routing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaceRouting.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/spaces/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.groups.length ? s.groups.join(", ") : "-"}
                </TableCell>
                <TableCell>{s.autoIntake ? "On" : "Off"}</TableCell>
                <TableCell>
                  {s.kind === "video" ? "n/a" : s.aiRouting ? "On" : "Off"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">AI instructions</h2>
        <p className="text-muted-foreground mb-2 text-sm">
          The built-in prompt the AI follows is fixed (it defines the response
          format). Your additions are edited in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          and appended after it.
        </p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {BASE_SYSTEM_PROMPT}
        </pre>
        <p className="mt-3 mb-1 text-sm font-medium">Your additions</p>
        {config.instructions?.trim() ? (
          <pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap">
            {config.instructions}
          </pre>
        ) : (
          <p className="text-muted-foreground text-sm">None set.</p>
        )}
      </section>

      <h2 className="mb-2 text-lg font-medium">Routing log</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Newest first, latest 200 shown.
      </p>
      <p className="text-muted-foreground mb-4 text-sm">
        {total} decisions: {totals.ai} AI · {totals.group} topic group ·{" "}
        {totals.rule} rule · {totals.inbox} left in feed
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
