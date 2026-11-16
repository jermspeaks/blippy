"use server";

import { db } from "@/db";
import {
  blips,
  blipGroups,
  spaces,
  routingEvents,
  routingRules,
  type Blip,
} from "@/db/schema";
import { and, asc, count, eq, isNull, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { organizeLinks } from "@/lib/ai/organize";
import { getApiKey, providerInfo } from "@/lib/ai/providers";
import { getAiConfig } from "@/actions/settings";
import { parseVideoUrl } from "@/lib/video";
import { parseBookUrl } from "@/lib/book";
import { parseRepoUrl } from "@/lib/repo";
import { hydratePendingRepos } from "@/lib/repo-hydrate";
import { resolveKindSpaces } from "@/lib/kind-spaces";
import { hydratePendingBooks, save as saveBookDetails } from "@/lib/book-hydrate";
import { confirmAiBooks, AI_BOOK_REASON } from "@/lib/book-ai";
import { pickRoute, matchRule } from "@/lib/routing";
import { aiSpaceOptions, aiSpaceId, routingEvent } from "@/lib/route-helpers";
import { endOfToday } from "@/lib/due";

const AI_CHUNK = 50;
const REROUTE_CAP = 200;

/** Feed blips: active, not stored in a space, and due today (snoozed ones are excluded). */
function feedCondition() {
  return and(
    eq(blips.status, "active"),
    isNull(blips.spaceId),
    or(
      lte(blips.nextReviewAt, endOfToday()),
      sql`${blips.nextReviewAt} IS NULL`
    )
  );
}

export async function countRerouteCandidates(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(blips)
    .where(feedCondition());
  return row?.n ?? 0;
}

export type RerouteResult =
  | {
      ok: true;
      checked: number;
      moved: number;
      byRule: number;
      byGroup: number;
      byAi: number;
      /** Feed blips beyond this run's cap that were not checked. */
      remaining: number;
      usedAi: boolean;
      warnings: string[];
    }
  | { ok: false; error: string };

/**
 * Re-evaluate where feed blips should go after spaces or rules changed.
 * Same order as capture (domain rule, video, linked group, AI), but it never
 * rewrites content: no page fetches, no title/summary/group changes (apart from
 * looking up book details for blips that land in a book space). The AI
 * step reuses each blip's stored title and summary. Only blips that move are
 * logged; blips already in a space are never touched.
 */
export async function rerouteFeedBlips(): Promise<RerouteResult> {
  const warnings: string[] = [];
  const total = await countRerouteCandidates();
  if (total === 0) return { ok: false, error: "No feed blips to re-route." };

  const candidates = await db
    .select()
    .from(blips)
    .where(feedCondition())
    .orderBy(asc(blips.createdAt))
    .limit(REROUTE_CAP);

  const [allSpaces, rules, groups] = await Promise.all([
    db.select().from(spaces),
    db.select().from(routingRules),
    db.select().from(blipGroups),
  ]);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const kind = resolveKindSpaces(
    candidates.map((b) => b.url),
    allSpaces
  );
  const { videoSpaceId, bookSpaceId, codeSpaceId } = kind;
  const bookSpaceIds = kind.bookSpaceIds;
  const spaceById = kind.spaceById;

  const groupSpaceFor = (b: Blip) => {
    const g = b.groupId ? groupById.get(b.groupId) : null;
    const space = g?.spaceId ? spaceById.get(g.spaceId) : null;
    return space?.autoIntake ? space.id : null;
  };
  const deterministic = (b: Blip) =>
    pickRoute({
      domainRule: b.url ? matchRule(b.url, rules) : null,
      videoSpaceId: parseVideoUrl(b.url) ? videoSpaceId : null,
      bookSpaceId: parseBookUrl(b.url) ? bookSpaceId : null,
      bookSpaceIds,
      groupSpaceId: groupSpaceFor(b),
      aiSpaceId: null,
      groupLabel: b.groupId ? groupById.get(b.groupId)?.label : null,
    });

  // Only ask the AI about blips the deterministic steps could not place.
  const needsAi = candidates.filter((b) => b.url && !deterministic(b));
  const ai = new Map<
    string,
    { space: string | null; reason: string | null; book: { title: string; author: string | null } | null }
  >();
  let usedAi = false;
  const config = await getAiConfig();
  if (needsAi.length > 0 && aiSpaceOptions(allSpaces).length > 0) {
    if (!getApiKey(config.provider)) {
      warnings.push(
        `No ${providerInfo[config.provider].envKey} set, so the AI step was skipped; rules, videos and linked topics were still applied.`
      );
    } else {
      try {
        for (let i = 0; i < needsAi.length; i += AI_CHUNK) {
          const chunk = needsAi.slice(i, i + AI_CHUNK);
          const out = await organizeLinks(
            config,
            chunk.map((b, j) => ({
              id: j,
              url: b.url!,
              linkText: b.title ?? "",
              nested: false,
              og: {
                title: b.title,
                description: b.summary,
                siteName: b.siteName,
              },
            })),
            [],
            aiSpaceOptions(allSpaces)
          );
          chunk.forEach((b, j) => {
            const r = out.get(j);
            if (r) ai.set(b.id, { space: r.space, reason: r.reason, book: r.book });
          });
        }
        usedAi = true;
      } catch (err) {
        console.error("AI re-route failed", err);
        warnings.push(
          `AI step failed (${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}); rules, videos and linked topics were still applied.`
        );
      }
    }
  }

  // Pages the AI says are a book must be confirmed before they may enter the book space.
  const confirmed = await confirmAiBooks(
    needsAi.map((b) => ({ key: b.id, url: b.url, book: ai.get(b.id)?.book ?? null }))
  );
  let tier2BookSpaceId: string | null = null;
  if (confirmed.size > 0) {
    const k = resolveKindSpaces([], allSpaces, { forceBook: true });
    tier2BookSpaceId = k.bookSpaceId;
    for (const [id, sp] of k.spaceById) spaceById.set(id, sp);
    for (const id of k.bookSpaceIds) bookSpaceIds.add(id);
  }

  const now = new Date();
  const names = new Map([...spaceById].map(([id, s]) => [id, s.name]));
  const moves: {
    blip: Blip;
    route: NonNullable<ReturnType<typeof pickRoute>>;
  }[] = [];
  for (const b of candidates) {
    const route =
      deterministic(b) ??
      pickRoute({
        videoSpaceId: null,
        bookSpaceId: confirmed.has(b.id) ? tier2BookSpaceId : null,
        bookReason: AI_BOOK_REASON,
        bookSpaceIds,
        // A repository link falls back to the code space only after the AI found no better space.
        codeSpaceId: parseRepoUrl(b.url) ? codeSpaceId : null,
        groupSpaceId: null,
        aiSpaceId: aiSpaceId(allSpaces, ai.get(b.id)?.space),
        aiReason: ai.get(b.id)?.reason,
      });
    if (route) moves.push({ blip: b, route });
  }

  if (moves.length > 0) {
    db.transaction((tx) => {
      for (const { blip, route } of moves) {
        tx.update(blips)
          .set({
            spaceId: route.spaceId,
            routedBy: route.routedBy,
            routedReason: route.reason,
            updatedAt: now,
          })
          .where(and(eq(blips.id, blip.id), isNull(blips.spaceId)))
          .run();
      }
      tx.insert(routingEvents)
        .values(
          moves.map(({ blip, route }) =>
            routingEvent({
              blipId: blip.id,
              blipTitle: blip.title ?? blip.content.slice(0, 120),
              url: blip.url,
              route,
              usedAi,
              spaceName: (id) => names.get(id) ?? null,
              source: "reroute",
              now,
            })
          )
        )
        .run();
    });
  }

  for (const m of moves) {
    const info = confirmed.get(m.blip.id);
    if (info && m.route.spaceId === tier2BookSpaceId) saveBookDetails(m.blip, { info, exact: false });
  }
  if (moves.some((m) => spaceById.get(m.route.spaceId)?.kind === "book")) {
    await hydratePendingBooks();
  }
  if (moves.some((m) => spaceById.get(m.route.spaceId)?.kind === "code")) {
    await hydratePendingRepos();
  }

  revalidatePath("/");
  revalidatePath("/spaces");
  revalidatePath("/routing");
  const by = (k: "rule" | "group" | "ai") =>
    moves.filter((m) => m.route.routedBy === k).length;
  return {
    ok: true,
    checked: candidates.length,
    moved: moves.length,
    byRule: by("rule"),
    byGroup: by("group"),
    byAi: by("ai"),
    remaining: Math.max(0, total - candidates.length),
    usedAi,
    warnings,
  };
}
