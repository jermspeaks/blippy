/**
 * Built-in system prompt for link organization. It defines the JSON contract
 * the importer parses, so users can append instructions but not replace it.
 */
export const BASE_SYSTEM_PROMPT = `You turn a person's daily link notes into structured "blips" for a resurfacing feed.
For each input link, write:
- title: a clear, specific title (max 90 chars). Prefer the page's own title; clean up site-name suffixes and noise like "(1)".
- summary: one or two plain sentences (max 240 chars) on what the link is about. Use only the provided text; if there is little to go on, say less rather than inventing details.
- group: a short topic label (2-4 words, Title Case) when this link is topically similar to at least one other link in the batch or to an existing group; otherwise null. Nested/indented links usually relate to the link above them. If a topic fits an existing group label, reuse that label exactly.
Respond with only a JSON object: {"blips":[{"id":number,"title":string,"summary":string,"group":string|null}]}. Include every id exactly once.`;

export function buildSystemPrompt(extraInstructions: string | undefined): string {
  const extra = extraInstructions?.trim();
  return extra
    ? `${BASE_SYSTEM_PROMPT}\n\nAdditional instructions from the user (follow them unless they conflict with the JSON format above):\n${extra}`
    : BASE_SYSTEM_PROMPT;
}
