export const aiProviders = ["openai", "anthropic"] as const;
export type AiProvider = (typeof aiProviders)[number];

export const providerInfo: Record<
  AiProvider,
  { label: string; envKey: string; defaultModel: string }
> = {
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-5-5",
  },
};

/** All optional: undefined means "use the provider's default". */
export type AiOptions = {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  /** OpenAI only. */
  frequencyPenalty?: number;
  /** OpenAI only. */
  presencePenalty?: number;
};

export type AiConfig = {
  provider: AiProvider;
  model: string;
  options?: AiOptions;
  /** Extra user instructions appended to the built-in system prompt. */
  instructions?: string;
};

/** OpenAI reasoning models reject sampling parameters (temperature, top_p, penalties). */
export function isOpenAiReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model);
}

export function getApiKey(provider: AiProvider): string | null {
  return process.env[providerInfo[provider].envKey]?.trim() || null;
}

/** Pull the first JSON object out of a model reply (tolerates code fences / prose). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in model reply");
  return JSON.parse(text.slice(start, end + 1));
}

/** Ask the configured provider for a JSON object. Throws on any failure. */
export async function generateJson(
  config: AiConfig,
  system: string,
  user: string
): Promise<unknown> {
  const apiKey = getApiKey(config.provider);
  if (!apiKey) {
    throw new Error(`${providerInfo[config.provider].envKey} is not set`);
  }
  const signal = AbortSignal.timeout(90_000);
  const o = config.options ?? {};

  if (config.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        ...(o.maxOutputTokens !== undefined && {
          max_completion_tokens: o.maxOutputTokens,
        }),
        ...(!isOpenAiReasoningModel(config.model) && {
          ...(o.temperature !== undefined && { temperature: o.temperature }),
          ...(o.topP !== undefined && { top_p: o.topP }),
          ...(o.frequencyPenalty !== undefined && {
            frequency_penalty: o.frequencyPenalty,
          }),
          ...(o.presencePenalty !== undefined && {
            presence_penalty: o.presencePenalty,
          }),
        }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return extractJson(data.choices?.[0]?.message?.content ?? "");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: o.maxOutputTokens ?? 8000,
      // Anthropic temperature is 0-1; clamp so a shared OpenAI-style value can't error.
      ...(o.temperature !== undefined && {
        temperature: Math.min(o.temperature, 1),
      }),
      ...(o.topP !== undefined && { top_p: o.topP }),
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return extractJson(text);
}
