"use server";

import { db } from "@/db";
import {
  blips,
  blipGroups,
  spaces,
  routingEvents,
  routingRules,
  type BlipGroup,
  type RoutingRule,
  type Space,
} from "@/db/schema";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractLinks } from "@/lib/markdown-links";
import { fetchLinkMetadata, type LinkMetadata } from "@/lib/og";
import { organizeLinks, type OrganizedBlip } from "@/lib/ai/organize";
import { getApiKey, providerInfo } from "@/lib/ai/providers";
import { getAiConfig } from "@/actions/settings";
import { parseVideoUrl } from "@/lib/video";
import { ensureVideoSpace } from "@/lib/video-space";
import { pickRoute, matchRule } from "@/lib/routing";
import { aiSpaceOptions, aiSpaceId, routingEvent } from "@/lib/route-helpers";

const MAX_LINKS = 50;
const FETCH_CONCURRENCY = 6;

const inputSchema = z.object({
  markdown: z.string().min(1, "Paste some notes first").max(200_000),
});

export type ImportResult =
  | {
      ok: true;
      created: number;
      storedInSpaces: number;
      skippedDuplicates: number;
      groups: number;
      usedAi: boolean;
      warnings: string[];
    }
  | { ok: false; error: string };

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

function fallbackTitle(link: { text: string; url: string }, og: LinkMetadata) {
  if (og.title) return og.title;
  if (link.text) return link.text;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

type Enriched = { og: LinkMetadata; ai: OrganizedBlip | undefined };

/** Fetch OG metadata, then ask the AI for titles/summaries/groups. Falls back to OG data. */
async function enrichLinks(
  links: { url: string; text: string; nested: boolean }[],
  warnings: string[]
): Promise<{
  enriched: Enriched[];
  usedAi: boolean;
  existingGroups: BlipGroup[];
  allSpaces: Space[];
  rules: RoutingRule[];
}> {
  const metas = await mapLimit(links, FETCH_CONCURRENCY, (l) => fetchLinkMetadata(l.url));
  const config = await getAiConfig();
  const existingGroups = await db.select().from(blipGroups);
  const allSpaces = await db.select().from(spaces);
  const rules = await db.select().from(routingRules);
  // Space names are preferred labels, so related links land in the matching space.
  const preferredLabels = Array.from(
    new Set([...existingGroups.map((g) => g.label), ...allSpaces.map((x) => x.name)])
  );
  let organized = new Map<number, OrganizedBlip>();
  let usedAi = false;
  if (getApiKey(config.provider)) {
    try {
      organized = await organizeLinks(
        config,
        links.map((l, i) => ({
          id: i,
          url: l.url,
          linkText: l.text,
          nested: l.nested,
          og: metas[i],
        })),
        preferredLabels,
        aiSpaceOptions(allSpaces)
      );
      usedAi = true;
    } catch (err) {
      console.error("AI organize failed", err);
      warnings.push(
        `AI step failed (${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}); used page metadata instead.`
      );
    }
  } else {
    warnings.push(
      `No ${providerInfo[config.provider].envKey} set, so blips use page metadata without AI summaries or grouping.`
    );
  }
  return {
    enriched: metas.map((og, i) => ({ og, ai: organized.get(i) })),
    usedAi,
    existingGroups,
    allSpaces,
    rules,
  };
}

/**
 * Map AI group labels to group ids, creating (pending) groups for new labels.
 * A new group whose label matches a space name is linked to that space, and
 * `spaceFor` says which space (if any) should store a blip in a given group.
 */
function makeGroupResolver(existingGroups: BlipGroup[], allSpaces: Space[], now: Date) {
  const idByLabel = new Map(existingGroups.map((g) => [g.label.toLowerCase(), g.id]));
  const spaceByGroup = new Map(existingGroups.map((g) => [g.id, g.spaceId]));
  const spaceById = new Map(allSpaces.map((x) => [x.id, x]));
  const spaceByName = new Map(allSpaces.map((x) => [x.name.toLowerCase(), x]));
  const pending: {
    id: string;
    label: string;
    spaceId: string | null;
    createdAt: Date;
  }[] = [];
  return {
    pending,
    resolve(label: string | null | undefined): string | null {
      if (!label) return null;
      const key = label.toLowerCase();
      if (!idByLabel.has(key)) {
        const id = randomUUID();
        const spaceId = spaceByName.get(key)?.id ?? null;
        idByLabel.set(key, id);
        spaceByGroup.set(id, spaceId);
        pending.push({ id, label, spaceId, createdAt: now });
      }
      return idByLabel.get(key)!;
    },
    /** Space that auto-intakes blips of this group, or null. */
    spaceFor(groupId: string | null): string | null {
      if (!groupId) return null;
      const space = spaceById.get(spaceByGroup.get(groupId) ?? "");
      return space?.autoIntake ? space.id : null;
    },
  };
}

export async function importMarkdown(markdown: string): Promise<ImportResult> {
  const parsed = inputSchema.safeParse({ markdown });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const warnings: string[] = [];
  let links = extractLinks(parsed.data.markdown);
  if (links.length === 0) return { ok: false, error: "No links found in the notes." };
  if (links.length > MAX_LINKS) {
    warnings.push(`Only the first ${MAX_LINKS} of ${links.length} links were imported.`);
    links = links.slice(0, MAX_LINKS);
  }

  // Skip URLs that are already blips.
  const existing = await db
    .select({ url: blips.url })
    .from(blips)
    .where(inArray(blips.url, links.map((l) => l.url)));
  const known = new Set(existing.map((e) => e.url));
  const fresh = links.filter((l) => !known.has(l.url));
  const skippedDuplicates = links.length - fresh.length;
  if (fresh.length === 0) {
    return {
      ok: true,
      created: 0,
      storedInSpaces: 0,
      skippedDuplicates,
      groups: 0,
      usedAi: false,
      warnings,
    };
  }

  const { enriched, usedAi, existingGroups, allSpaces, rules } = await enrichLinks(fresh, warnings);

  const now = new Date();
  const groups = makeGroupResolver(existingGroups, allSpaces, now);
  // Video links route to the video space regardless of AI topic group.
  const videoSpaceId = fresh.some((l) => parseVideoUrl(l.url))
    ? (db.transaction((tx) => ensureVideoSpace(tx))?.id ?? null)
    : null;
  const videoSpace = videoSpaceId ? allSpaces.find((x) => x.id === videoSpaceId) : null;
  const names = new Map(allSpaces.map((x) => [x.id, x.name]));
  if (videoSpaceId && !videoSpace) {
    const [created] = await db.select().from(spaces).where(eq(spaces.id, videoSpaceId));
    if (created) names.set(created.id, created.name);
  }
  const events: ReturnType<typeof routingEvent>[] = [];
  const rows = fresh.map((link, i) => {
    const { og, ai } = enriched[i];
    const title = ai?.title || fallbackTitle(link, og);
    const groupId = groups.resolve(ai?.group);
    const video = parseVideoUrl(link.url);
    const route = pickRoute({
      domainRule: matchRule(link.url, rules),
      videoSpaceId: video ? videoSpaceId : null,
      groupSpaceId: groups.spaceFor(groupId),
      aiSpaceId: aiSpaceId(allSpaces, ai?.space),
      groupLabel: ai?.group,
      aiReason: ai?.reason,
    });
    const blipId = randomUUID();
    events.push(
      routingEvent({
        blipId,
        blipTitle: title,
        url: link.url,
        route,
        usedAi,
        spaceName: (id) => names.get(id) ?? null,
        source: "capture",
        now,
      })
    );
    return {
      id: blipId,
      content: `[${title}](${link.url})`,
      title,
      summary: ai?.summary || og.description?.slice(0, 500) || null,
      imageUrl: video?.thumbnailUrl ?? og.imageUrl,
      url: link.url,
      siteName: og.siteName,
      groupId,
      spaceId: route?.spaceId ?? null,
      routedBy: route?.routedBy ?? null,
      routedReason: route?.reason ?? null,
      status: "active" as const,
      nextReviewAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  db.transaction((tx) => {
    if (groups.pending.length) tx.insert(blipGroups).values(groups.pending).run();
    tx.insert(blips).values(rows).run();
    tx.insert(routingEvents).values(events).run();
  });

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/spaces");
  return {
    ok: true,
    created: rows.length,
    storedInSpaces: rows.filter((r) => r.spaceId).length,
    skippedDuplicates,
    groups: groups.pending.length,
    usedAi,
    warnings,
  };
}

export type ReprocessResult =
  | { ok: true; updated: number; groups: number; warnings: string[] }
  | { ok: false; error: string };

/** Count of active blips that came from a link (what reprocess would touch). */
export async function countLinkBlips(): Promise<number> {
  const rows = await db
    .select({ id: blips.id })
    .from(blips)
    .where(and(isNotNull(blips.url), eq(blips.status, "active")));
  return rows.length;
}

const REPROCESS_CAP = 200;

/**
 * Re-run metadata fetch + AI organization over existing link blips, overwriting
 * title, summary, image, site name and group. Works in chunks of MAX_LINKS; each
 * chunk reuses groups created by earlier ones. If the AI step can't run for a
 * chunk, it stops without touching that chunk, so failures never replace good
 * data with fallbacks.
 */
export async function reprocessLinkBlips(): Promise<ReprocessResult> {
  const warnings: string[] = [];
  const targets = await db
    .select()
    .from(blips)
    .where(and(isNotNull(blips.url), eq(blips.status, "active")))
    .orderBy(asc(blips.createdAt))
    .limit(REPROCESS_CAP);
  if (targets.length === 0) return { ok: false, error: "No link blips to reprocess." };

  let updated = 0;
  let newGroups = 0;
  for (let start = 0; start < targets.length; start += MAX_LINKS) {
    const chunk = targets.slice(start, start + MAX_LINKS);
    const chunkWarnings: string[] = [];
    const { enriched, usedAi, existingGroups, allSpaces, rules } = await enrichLinks(
      chunk.map((b) => ({ url: b.url!, text: b.title ?? "", nested: false })),
      chunkWarnings
    );
    if (!usedAi) {
      const reason = chunkWarnings[0] ?? "AI step did not run.";
      if (updated === 0) return { ok: false, error: `${reason} Nothing was changed.` };
      warnings.push(`${reason} Stopped after ${updated} of ${targets.length}.`);
      break;
    }

    const now = new Date();
    const groups = makeGroupResolver(existingGroups, allSpaces, now);
    const videoSpaceId = chunk.some((b) => parseVideoUrl(b.url))
      ? (db.transaction((tx) => ensureVideoSpace(tx))?.id ?? null)
      : null;
    const names = new Map(allSpaces.map((x) => [x.id, x.name]));
    if (videoSpaceId && !names.has(videoSpaceId)) {
      const [created] = await db.select().from(spaces).where(eq(spaces.id, videoSpaceId));
      if (created) names.set(created.id, created.name);
    }
    const events: ReturnType<typeof routingEvent>[] = [];
    // Resolve groups first so new groups can be inserted before blips reference them.
    const updates = chunk.map((blip, i) => {
      const { og, ai } = enriched[i];
      const title =
        ai?.title || og.title || blip.title || fallbackTitle({ text: "", url: blip.url! }, og);
      const groupId = groups.resolve(ai?.group);
      const video = parseVideoUrl(blip.url);
      // Never move a blip out of a space it is already stored in.
      const route = blip.spaceId
        ? null
        : pickRoute({
            domainRule: matchRule(blip.url!, rules),
            videoSpaceId: video ? videoSpaceId : null,
            groupSpaceId: groups.spaceFor(groupId),
            aiSpaceId: aiSpaceId(allSpaces, ai?.space),
            groupLabel: ai?.group,
            aiReason: ai?.reason,
          });
      if (!blip.spaceId) {
        events.push(
          routingEvent({
            blipId: blip.id,
            blipTitle: title,
            url: blip.url,
            route,
            usedAi,
            spaceName: (id) => names.get(id) ?? null,
            source: "reprocess",
            now,
          })
        );
      }
      return {
        id: blip.id,
        set: {
          title,
          content: `[${title}](${blip.url})`,
          summary: ai?.summary || og.description?.slice(0, 500) || blip.summary,
          imageUrl: video?.thumbnailUrl ?? og.imageUrl ?? blip.imageUrl,
          siteName: og.siteName ?? blip.siteName,
          groupId,
          spaceId: blip.spaceId ?? route?.spaceId ?? null,
          routedBy: blip.spaceId ? blip.routedBy : (route?.routedBy ?? null),
          routedReason: blip.spaceId ? blip.routedReason : (route?.reason ?? null),
          updatedAt: now,
        },
      };
    });
    db.transaction((tx) => {
      if (groups.pending.length) tx.insert(blipGroups).values(groups.pending).run();
      for (const u of updates) tx.update(blips).set(u.set).where(eq(blips.id, u.id)).run();
      if (events.length) tx.insert(routingEvents).values(events).run();
    });
    updated += chunk.length;
    newGroups += groups.pending.length;
  }

  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/spaces");
  return { ok: true, updated, groups: newGroups, warnings };
}
