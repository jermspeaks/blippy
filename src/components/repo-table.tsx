"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ExternalLink, RefreshCw, Star, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { unstoreBlip } from "@/actions/spaces";
import { setBlipFizzled } from "@/actions/blips";
import { refreshRepo } from "@/actions/repos";
import { parseTopics, repoLanguages, repoSorts, viewRepos, type RepoRowData, type RepoSort } from "@/lib/repo-view";
import { routedByNote } from "@/components/stored-blip-item";

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
}

const MAX_TOPICS = 4;

function RepoRow({ blip, spaceId }: { blip: RepoRowData; spaceId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const repo = blip.repo;
  const topics = parseTopics(repo?.topics);
  const name = repo ? `${repo.owner}/${repo.name}` : (blip.title ?? blip.content.slice(0, 120));
  const description = repo?.description ?? blip.summary;
  const unmatched = !repo || repo.lookupStatus === "failed";
  const note = [unmatched ? "No repository details found" : "", routedByNote(blip.routedBy).replace(/ · $/, "")]
    .filter(Boolean)
    .join(" · ");

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const handleReturn = () =>
    run(async () => {
      await unstoreBlip(blip.id, spaceId);
      toast.success("Returned to feed");
    });
  const handleFizzle = () =>
    run(async () => {
      const r = await setBlipFizzled(blip.id);
      if (r.ok) toast.success("Blip fizzled");
      else toast.error("Failed to fizzle");
    });
  const handleRefresh = () =>
    run(async () => {
      const r = await refreshRepo(blip.id);
      if (!r.ok) toast.error(r.error);
      else if (r.found) toast.success("Repository details updated");
      else toast.error("No details found for this repository");
    });

  return (
    <TableRow>
      <TableCell className="max-w-md whitespace-normal">
        <div className="flex items-center gap-2">
          {blip.url ? (
            <a
              href={blip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:underline"
              title={blip.routedReason ?? undefined}
            >
              {name}
              <ExternalLink className="text-muted-foreground size-3 shrink-0" />
            </a>
          ) : (
            <span className="font-medium">{name}</span>
          )}
          {repo?.archived && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Archive className="size-3" />
              Archived
            </span>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
        )}
        {repo?.readmeExcerpt && repo.readmeExcerpt !== description && (
          <p className="text-muted-foreground/80 line-clamp-2 text-xs italic" title="From the README">
            {repo.readmeExcerpt}
          </p>
        )}
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{repo?.language ?? "—"}</TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {repo?.stars != null ? (
          <span className="inline-flex items-center gap-1">
            <Star className="text-muted-foreground size-3" />
            {compactCount(repo.stars)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden whitespace-normal md:table-cell">
        <div className="flex flex-wrap gap-1">
          {topics.slice(0, MAX_TOPICS).map((t) => (
            <span key={t} className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {t}
            </span>
          ))}
          {topics.length > MAX_TOPICS && (
            <span className="text-muted-foreground text-xs">+{topics.length - MAX_TOPICS}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap xl:table-cell">
        {repo?.license && repo.license !== "NOASSERTION" ? repo.license : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
        {repo?.pushedAt ? new Date(repo.pushedAt).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Look up repository details again"
          title="Look up repository details again"
        >
          <RefreshCw className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReturn}
          disabled={isPending}
          aria-label="Return to feed"
          title="Return to feed"
        >
          <Undo2 className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFizzle}
          disabled={isPending}
          aria-label="Fizzle"
          title="Fizzle"
          className="text-destructive hover:text-destructive"
        >
          <X className="size-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

const sortLabels: Record<RepoSort, string> = {
  default: "Default order",
  name: "Name",
  stars: "Most stars",
  updated: "Recently updated",
  language: "Language",
};

export function RepoTable({ blips, spaceId }: { blips: RepoRowData[]; spaceId: string }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [sort, setSort] = useState<RepoSort>("default");
  const languages = useMemo(() => repoLanguages(blips), [blips]);
  const rows = useMemo(() => viewRepos(blips, { query, language, sort }), [blips, query, language, sort]);
  const selectClass = "border-input bg-background h-9 rounded-md border px-2 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, description, topic…"
          aria-label="Filter repositories"
          className="max-w-xs"
        />
        {languages.length > 0 && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Filter by language"
            className={selectClass}
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as RepoSort)}
          aria-label="Sort repositories"
          className={selectClass}
        >
          {repoSorts.map((s) => (
            <option key={s} value={s}>
              {sortLabels[s]}
            </option>
          ))}
        </select>
        {(query || language) && (
          <span className="text-muted-foreground text-sm">
            {rows.length} of {blips.length}
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repository</TableHead>
            <TableHead>Language</TableHead>
            <TableHead className="text-right">Stars</TableHead>
            <TableHead className="hidden md:table-cell">Topics</TableHead>
            <TableHead className="hidden xl:table-cell">License</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <RepoRow key={b.id} blip={b} spaceId={spaceId} />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                No repositories match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
