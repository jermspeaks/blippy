"use server";

import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchModels } from "@/lib/ai/models";
import {
  aiProviders,
  providerInfo,
  getApiKey,
  type AiConfig,
  type AiOptions,
  type AiProvider,
} from "@/lib/ai/providers";

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

const optionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(128000).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

async function getStoredOptions(): Promise<AiOptions> {
  const raw = await getSetting("ai.options");
  if (!raw) return {};
  try {
    const parsed = optionsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function getAiConfig(): Promise<AiConfig> {
  const stored = await getSetting("ai.provider");
  const provider: AiProvider = (aiProviders as readonly string[]).includes(stored ?? "")
    ? (stored as AiProvider)
    : "openai";
  const model =
    (await getSetting(`ai.model.${provider}`)) ?? providerInfo[provider].defaultModel;
  return {
    provider,
    model,
    options: await getStoredOptions(),
    instructions: (await getSetting("ai.instructions")) ?? "",
  };
}

/** Settings plus which API keys are present in the environment (never the keys themselves). */
export async function getAiSettingsView() {
  const config = await getAiConfig();
  const models: Record<string, string> = {};
  const keyConfigured: Record<string, boolean> = {};
  for (const p of aiProviders) {
    models[p] =
      (await getSetting(`ai.model.${p}`)) ?? providerInfo[p].defaultModel;
    keyConfigured[p] = getApiKey(p) !== null;
  }
  return {
    provider: config.provider,
    models,
    keyConfigured,
    options: config.options ?? {},
    instructions: config.instructions ?? "",
  };
}

const saveSchema = z.object({
  provider: z.enum(aiProviders),
  model: z.string().trim().min(1).max(100),
  instructions: z.string().max(4000),
  options: optionsSchema,
});

export async function saveAiSettings(input: {
  provider: string;
  model: string;
  instructions: string;
  options: AiOptions;
}) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid settings" };
  await setSetting("ai.provider", parsed.data.provider);
  await setSetting(`ai.model.${parsed.data.provider}`, parsed.data.model);
  await setSetting("ai.instructions", parsed.data.instructions);
  await setSetting("ai.options", JSON.stringify(parsed.data.options));
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function listModels(provider: string) {
  if (!(aiProviders as readonly string[]).includes(provider)) {
    return { ok: false as const, error: "Unknown provider" };
  }
  try {
    return { ok: true as const, models: await fetchModels(provider as AiProvider) };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to load models",
    };
  }
}
