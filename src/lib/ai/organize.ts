import { z } from "zod";
import { generateJson, type AiConfig } from "./providers";
import { buildSystemPrompt } from "./prompt";

export type OrganizeInput = {
  id: number;
  url: string;
  linkText: string;
  nested: boolean;
  og: { title: string | null; description: string | null; siteName: string | null };
};

export type OrganizedBlip = {
  title: string;
  summary: string;
  /** Topic label shared by related blips, or null. */
  group: string | null;
};

// Models sometimes return null/missing fields for sparse links. Validate each
// item on its own so one bad entry doesn't discard the whole batch.
const itemSchema = z.object({
  id: z.number(),
  title: z.string().nullish(),
  summary: z.string().nullish(),
  group: z.string().nullish(),
});
const responseSchema = z.object({ blips: z.array(z.unknown()) });

/**
 * Ask the AI for titles/summaries/groups. Items the model omits fall back to
 * OG metadata. Groups with a single member (and no existing match) are dropped.
 */
export async function organizeLinks(
  config: AiConfig,
  items: OrganizeInput[],
  existingGroupLabels: string[]
): Promise<Map<number, OrganizedBlip>> {
  const payload = {
    existingGroups: existingGroupLabels,
    links: items.map((i) => ({
      id: i.id,
      url: i.url,
      linkText: i.linkText,
      nested: i.nested,
      pageTitle: i.og.title,
      pageDescription: i.og.description?.slice(0, 400) ?? null,
      site: i.og.siteName,
    })),
  };
  const raw = await generateJson(
    config,
    buildSystemPrompt(config.instructions),
    JSON.stringify(payload)
  );
  const parsed = responseSchema.parse(raw);

  const byId = new Map<number, OrganizedBlip>();
  for (const entry of parsed.blips) {
    const item = itemSchema.safeParse(entry);
    if (!item.success) continue;
    const b = item.data;
    byId.set(b.id, {
      // Empty strings let the caller fall back to page metadata.
      title: (b.title ?? "").trim().slice(0, 200),
      summary: (b.summary ?? "").trim().slice(0, 500),
      group: b.group?.trim() || null,
    });
  }

  const existing = new Set(existingGroupLabels.map((l) => l.toLowerCase()));
  const counts = new Map<string, number>();
  for (const b of byId.values()) {
    if (b.group) counts.set(b.group.toLowerCase(), (counts.get(b.group.toLowerCase()) ?? 0) + 1);
  }
  for (const b of byId.values()) {
    if (b.group) {
      const k = b.group.toLowerCase();
      if ((counts.get(k) ?? 0) < 2 && !existing.has(k)) b.group = null;
    }
  }
  return byId;
}
