type ExportHighlight = { exact: string; note: string | null };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Highlights as markdown: a heading, the source link, then each quote (with its note) in the order given. */
export function highlightsToMarkdown(
  article: { title: string; url: string | null },
  highlights: ExportHighlight[]
): string {
  const lines = [`# ${oneLine(article.title) || "Untitled"}`];
  if (article.url) lines.push("", `Source: ${article.url}`);
  lines.push("");
  for (const h of highlights) {
    // A blockquote line per source line, so multi-paragraph quotes stay quoted.
    lines.push(
      ...h.exact
        .trim()
        .split(/\n+/)
        .map((l) => `> ${oneLine(l)}`)
        .filter((l) => l !== ">")
    );
    if (h.note?.trim()) lines.push("", `Note: ${oneLine(h.note)}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** A filename-safe slug of the title for a downloaded export. */
export function exportFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "article"}-highlights.md`;
}
