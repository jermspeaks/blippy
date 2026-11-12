import { getApiKey, type AiProvider } from "./providers";

type Listed = { id: string; created: number };

// OpenAI's /v1/models mixes in embeddings, audio, image, moderation, etc.
const OPENAI_CHAT = /^(gpt-|o\d|chatgpt-)/;
const OPENAI_EXCLUDE =
  /(embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct|codex|computer-use|-\d{4}-\d{2}-\d{2}$)/;

/** List models available to the configured key, newest first. Throws on failure. */
export async function fetchModels(provider: AiProvider): Promise<string[]> {
  const apiKey = getApiKey(provider);
  if (!apiKey) throw new Error("API key not set");
  const signal = AbortSignal.timeout(15_000);

  let listed: Listed[];
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/models", {
      signal,
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    listed = (data.data as { id: string; created: number }[])
      .filter((m) => OPENAI_CHAT.test(m.id) && !OPENAI_EXCLUDE.test(m.id))
      .map((m) => ({ id: m.id, created: m.created }));
  } else {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      signal,
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    listed = (data.data as { id: string; created_at: string }[]).map((m) => ({
      id: m.id,
      created: Date.parse(m.created_at) / 1000,
    }));
  }
  return listed.sort((a, b) => b.created - a.created).map((m) => m.id);
}
