"use server";

import { db } from "@/db";
import { blips, blipGroups, type BlipGroup } from "@/db/schema";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractLinks } from "@/lib/markdown-links";
import { fetchLinkMetadata, type LinkMetadata } from "@/lib/og";
import { organizeLinks, type OrganizedBlip } from "@/lib/ai/organize";
import { getApiKey, providerInfo } from "@/lib/ai/providers";
import { getAiConfig } from "@/actions/settings";

const MAX_LINKS = 50;
const FETCH_CONCURRENCY = 6;

const inputSchema = z.object({
  markdown: z.string().min(1, "Paste some notes first").max(200_000),
});

export type ImportResult =
  | {
      ok: true;
      created: number;
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
): Promise<{ enriched: Enriched[]; usedAi: boolean; existingGroups: BlipGroup[] }> {
  const metas = await mapLimit(links, FETCH_CONCURRENCY, (l) => fetchLinkMetadata(l.url));
  const config = await getAiConfig();
  const existingGroups = await db.select().from(blipGroups);
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
        existingGroups.map((g) => g.label)
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
  };
}

/** Map AI group labels to group ids, creating (pending) groups for new labels. */
function makeGroupResolver(existingGroups: BlipGroup[], now: Date) {
  const idByLabel = new Map(existingGroups.map((g) => [g.label.toLowerCase(), g.id]));
  const pending: { id: string; label: string; createdAt: Date }[] = [];
  return {
    pending,
    resolve(label: string | null | undefined): string | null {
      if (!label) return null;
      const key = label.toLowerCase();
      if (!idByLabel.has(key)) {
        const id = randomUUID();
        idByLabel.set(key, id);
        pending.push({ id, label, createdAt: now });
      }
      return idByLabel.get(key)!;
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
    return { ok: true, created: 0, skippedDuplicates, groups: 0, usedAi: false, warnings };
  }

  const { enriched, usedAi, existingGroups } = await enrichLinks(fresh, warnings);

  const now = new Date();
  const groups = makeGroupResolver(existingGroups, now);
  const rows = fresh.map((link, i) => {
    const { og, ai } = enriched[i];
    const title = ai?.title || fallbackTitle(link, og);
    return {
      id: randomUUID(),
      content: `[${title}](${link.url})`,
      title,
      summary: ai?.summary || og.description?.slice(0, 500) || null,
      imageUrl: og.imageUrl,
      url: link.url,
      siteName: og.siteName,
      groupId: groups.resolve(ai?.group),
      categoryId: null,
      status: "active" as const,
      nextReviewAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  db.transaction((tx) => {
    if (groups.pending.length) tx.insert(blipGroups).values(groups.pending).run();
    tx.insert(blips).values(rows).run();
  });

  revalidatePath("/");
  revalidatePath("/feed");
  return {
    ok: true,
    created: rows.length,
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
    const { enriched, usedAi, existingGroups } = await enrichLinks(
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
    const groups = makeGroupResolver(existingGroups, now);
    // Resolve groups first so new groups can be inserted before blips reference them.
    const updates = chunk.map((blip, i) => {
      const { og, ai } = enriched[i];
      const title =
        ai?.title || og.title || blip.title || fallbackTitle({ text: "", url: blip.url! }, og);
      return {
        id: blip.id,
        set: {
          title,
          content: `[${title}](${blip.url})`,
          summary: ai?.summary || og.description?.slice(0, 500) || blip.summary,
          imageUrl: og.imageUrl ?? blip.imageUrl,
          siteName: og.siteName ?? blip.siteName,
          groupId: groups.resolve(ai?.group),
          updatedAt: now,
        },
      };
    });
    db.transaction((tx) => {
      if (groups.pending.length) tx.insert(blipGroups).values(groups.pending).run();
      for (const u of updates) tx.update(blips).set(u.set).where(eq(blips.id, u.id)).run();
    });
    updated += chunk.length;
    newGroups += groups.pending.length;
  }

  revalidatePath("/");
  revalidatePath("/feed");
  return { ok: true, updated, groups: newGroups, warnings };
}
