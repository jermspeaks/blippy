"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ExternalLink, GitBranch, RefreshCw, Star, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unstoreBlip } from "@/actions/spaces";
import { setBlipFizzled } from "@/actions/blips";
import { refreshRepo } from "@/actions/repos";
import type { Blip, RepoDetails } from "@/db/schema";
import { routedByNote } from "@/components/stored-blip-item";

export function parseTopics(raw: string | undefined): string[] {
  try {
    const a = JSON.parse(raw ?? "[]");
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
}

const MAX_TOPICS = 6;

export function RepoCard({
  blip,
  repo,
  spaceId,
}: {
  blip: Blip;
  repo: RepoDetails | null;
  spaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const topics = parseTopics(repo?.topics);
  const slug = repo ? `${repo.owner}/${repo.name}` : null;
  const description = repo?.description ?? blip.summary;
  const unmatched = !repo || repo.lookupStatus === "failed";
  const pushed = repo?.pushedAt ? new Date(repo.pushedAt).toLocaleDateString() : null;

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
    <article className="bg-card flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-start gap-2">
        <GitBranch className="text-muted-foreground mt-1 size-4 shrink-0" />
        <div className="min-w-0">
          <h3 className="truncate leading-snug font-medium" title={slug ?? undefined}>
            {slug ?? blip.title ?? blip.content.slice(0, 120)}
          </h3>
          {slug && blip.title && blip.title !== repo?.name && blip.title !== slug && (
            <p className="text-muted-foreground line-clamp-1 text-xs">{blip.title}</p>
          )}
        </div>
      </div>
      {description && (
        <p className="text-muted-foreground line-clamp-3 text-sm">{description}</p>
      )}
      {topics.length > 0 && (
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
      )}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {repo?.language && <span>{repo.language}</span>}
        {repo?.stars != null && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3" />
            {compactCount(repo.stars)}
          </span>
        )}
        {repo?.license && <span>{repo.license}</span>}
        {pushed && <span>Updated {pushed}</span>}
        {repo?.archived && (
          <span className="inline-flex items-center gap-1">
            <Archive className="size-3" />
            Archived
          </span>
        )}
      </div>
      {(unmatched || blip.routedBy) && (
        <p className="text-muted-foreground text-xs" title={blip.routedReason ?? undefined}>
          {unmatched ? "No repository details found" : ""}
          {unmatched && blip.routedBy ? " · " : ""}
          {routedByNote(blip.routedBy).replace(/ · $/, "")}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-1 pt-1">
        {blip.url && (
          <a
            href={blip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
          >
            <ExternalLink className="size-3" />
            Open
          </a>
        )}
        <div className="flex gap-1">
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
        </div>
      </div>
    </article>
  );
}
