/**
 * Built-in system prompt for link organization. It defines the JSON contract
 * the importer parses, so users can append instructions but not replace it.
 */
export const BASE_SYSTEM_PROMPT = `You turn a person's daily link notes into structured "blips" for a resurfacing feed.
For each input link, write:
- title: a clear, specific title (max 90 chars). Prefer the page's own title; clean up site-name suffixes and noise like "(1)".
- summary: one or two plain sentences (max 240 chars) on what the link is about. Use only the provided text; if there is little to go on, say less rather than inventing details.
- group: a short topic label (2-4 words, Title Case) when this link is topically similar to at least one other link in the batch or to an existing group; otherwise null. Nested/indented links usually relate to the link above them. If a topic fits an existing group label, reuse that label exactly.
- space: if the input lists "spaces" (each with a name and description) and this link clearly belongs in one of them, that space's name copied exactly; otherwise null. Only choose a space when the fit is obvious from its name and description; when unsure, use null.
- reason: when space is not null, one short sentence (max 120 chars) saying why this link fits that space; otherwise null.
- book: only when the link is the page for ONE specific published book: a retailer, publisher or catalog page for that title, or a reference entry about the book itself (for example the Wikipedia article titled with a novel or nonfiction book's name, or a Goodreads/Open Library entry). Set it for those even when the summary reads like an encyclopedia article. An object {"title": the book's own title, "author": its author or null}; otherwise null. Pages about an author, a film or series, a topic, or a list of books are not books; neither are articles, newsletters (Substack and similar) or reviews. Only name a book you recognize; when unsure, use null.
Respond with only a JSON object: {"blips":[{"id":number,"title":string,"summary":string,"group":string|null,"space":string|null,"reason":string|null,"book":{"title":string,"author":string|null}|null}]}. Include every id exactly once.`;

export function buildSystemPrompt(extraInstructions: string | undefined): string {
  const extra = extraInstructions?.trim();
  return extra
    ? `${BASE_SYSTEM_PROMPT}\n\nAdditional instructions from the user (follow them unless they conflict with the JSON format above):\n${extra}`
    : BASE_SYSTEM_PROMPT;
}
