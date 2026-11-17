import { and, asc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { blips, repoDetails, spaces, type Blip } from "@/db/schema";
import { parseRepoUrl } from "@/lib/repo";
import { lookupReadmeExcerpt, lookupRepo } from "@/lib/repo-lookup";

const CONCURRENCY = 3;

/** `deferred`: the host was unavailable (rate limit, network); nothing was recorded, so it is retried later. */
export type RepoHydrateCounts = { ok: number; failed: number; deferred: number };

/** Active repository blips in a code space with no details row yet, or details but no README excerpt tried yet. */
export function pendingRepoBlips(limit: number, spaceId?: string): Blip[] {
  return db
    .select({ blip: blips })
    .from(blips)
    .innerJoin(spaces, eq(blips.spaceId, spaces.id))
    .leftJoin(repoDetails, eq(repoDetails.blipId, blips.id))
    .where(
      and(
        eq(spaces.kind, "code"),
        eq(blips.status, "active"),
        isNotNull(blips.url),
        or(
          isNull(repoDetails.blipId),
          and(eq(repoDetails.lookupStatus, "ok"), isNull(repoDetails.readmeExcerpt))
        ),
        spaceId ? eq(blips.spaceId, spaceId) : undefined
      )
    )
    .orderBy(asc(blips.createdAt))
    .limit(limit)
    .all()
    .map((r) => r.blip);
}

/**
 * Look up and store repository details. Never throws. A 404 or an API-less host
 * is recorded as failed (the card's refresh retries); an unavailable host is
 * deferred. The blip's title and image are left alone; its summary is filled
 * from the repo description only when it has none.
 */
export async function hydrateRepos(targets: Blip[]): Promise<RepoHydrateCounts> {
  const counts: RepoHydrateCounts = { ok: 0, failed: 0, deferred: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (next < targets.length) {
        const blip = targets[next++];
        const ref = parseRepoUrl(blip.url);
        if (!ref) {
          counts.failed++;
          continue;
        }
        let info: Awaited<ReturnType<typeof lookupRepo>>;
        try {
          info = await lookupRepo(ref);
        } catch (err) {
          console.error("Repo lookup failed", err instanceof Error ? err.message : err);
          counts.deferred++;
          continue;
        }
        const now = new Date();
        // Best effort: when the host is busy the excerpt stays unset (null) and is retried later.
        let readme: string | undefined;
        if (info) {
          try {
            readme = await lookupReadmeExcerpt(ref);
          } catch (err) {
            console.error("README lookup failed", err instanceof Error ? err.message : err);
          }
        }
        if (!info) {
          // Keep earlier good details; record a failure only when there are none.
          db.insert(repoDetails)
            .values({ blipId: blip.id, ...ref, lookupStatus: "failed", fetchedAt: now })
            .onConflictDoNothing()
            .run();
          counts.failed++;
          continue;
        }
        const details = {
          ...ref,
          description: info.description,
          stars: info.stars,
          language: info.language,
          topics: JSON.stringify(info.topics),
          license: info.license,
          homepage: info.homepage,
          pushedAt: info.pushedAt,
          archived: info.archived,
          ...(readme === undefined ? {} : { readmeExcerpt: readme }),
          lookupStatus: "ok" as const,
          fetchedAt: now,
        };
        db.transaction((tx) => {
          tx.insert(repoDetails)
            .values({ blipId: blip.id, ...details })
            .onConflictDoUpdate({ target: repoDetails.blipId, set: details })
            .run();
          if (!blip.summary && info.description) {
            tx.update(blips)
              .set({ summary: info.description.slice(0, 500), updatedAt: now })
              .where(eq(blips.id, blip.id))
              .run();
          }
        });
        counts.ok++;
      }
    })
  );
  return counts;
}

/** Hydrate up to `limit` blips in code spaces that were never looked up. */
export async function hydratePendingRepos(limit = 25, spaceId?: string): Promise<RepoHydrateCounts> {
  return hydrateRepos(pendingRepoBlips(limit, spaceId));
}
