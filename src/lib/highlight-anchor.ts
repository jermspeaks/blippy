/**
 * Text-quote anchoring for reader highlights. A highlight is stored as the
 * selected text plus a few words either side, never as a DOM position, so it
 * can be found again in the same saved article and re-applied as <mark>s.
 * All offsets are into the concatenation of the article's text nodes.
 */

const CONTEXT_CHARS = 32;
export const MAX_QUOTE = 2000;

export type Anchor = { exact: string; prefix: string; suffix: string };

type Index = { text: string; nodes: { node: Text; start: number }[] };

/** The article's text nodes with their offsets into the combined text. */
export function buildIndex(root: Node): Index {
  const nodes: Index["nodes"] = [];
  let text = "";
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    nodes.push({ node, start: text.length });
    text += node.data;
  }
  return { text, nodes };
}

/** Describe a selection as an anchor and its offsets, or null if it holds no text. */
export function describeRange(
  root: Node,
  range: Range
): (Anchor & { start: number; end: number }) | null {
  const { text, nodes } = buildIndex(root);
  let start = -1;
  let end = -1;
  for (const { node, start: base } of nodes) {
    if (!range.intersectsNode(node)) continue;
    const a = node === range.startContainer ? range.startOffset : 0;
    const b = node === range.endContainer ? range.endOffset : node.length;
    if (b <= a) continue;
    if (start === -1) start = base + a;
    end = base + b;
  }
  if (start === -1 || end <= start) return null;
  // Trim whitespace at both ends of the selection.
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end <= start || end - start > MAX_QUOTE) return null;
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: text.slice(end, end + CONTEXT_CHARS),
    start,
    end,
  };
}

const commonSuffix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};
const commonPrefix = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

/**
 * Find an anchor in the text. If the quote appears more than once, the
 * occurrence whose surrounding words match best wins. Null if it is gone.
 */
export function locate(text: string, anchor: Anchor): { start: number; end: number } | null {
  if (!anchor.exact) return null;
  let best: { start: number; score: number } | null = null;
  for (let i = text.indexOf(anchor.exact); i !== -1; i = text.indexOf(anchor.exact, i + 1)) {
    const before = text.slice(Math.max(0, i - anchor.prefix.length), i);
    const after = text.slice(i + anchor.exact.length, i + anchor.exact.length + anchor.suffix.length);
    const score = commonSuffix(before, anchor.prefix) + commonPrefix(after, anchor.suffix);
    if (!best || score > best.score) best = { start: i, score };
  }
  return best ? { start: best.start, end: best.start + anchor.exact.length } : null;
}

/** Wrap [start, end) in <mark data-highlight-id>, one mark per text node it touches. Returns how many marks were made. */
export function applyMark(
  root: Node,
  start: number,
  end: number,
  attrs: { id: string; color: string; hasNote: boolean }
): number {
  const doc = root.ownerDocument!;
  const { nodes } = buildIndex(root);
  const pieces: { node: Text; from: number; to: number }[] = [];
  for (const { node, start: base } of nodes) {
    const from = Math.max(start, base) - base;
    const to = Math.min(end, base + node.length) - base;
    if (to <= from) continue;
    // Skip whitespace between blocks so marks don't bridge paragraph gaps.
    if (!node.data.slice(from, to).trim()) continue;
    pieces.push({ node, from, to });
  }
  for (const { node, from, to } of pieces) {
    const range = doc.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const mark = doc.createElement("mark");
    mark.dataset.highlightId = attrs.id;
    mark.dataset.color = attrs.color;
    if (attrs.hasNote) mark.dataset.hasNote = "true";
    range.surroundContents(mark);
  }
  return pieces.length;
}

/** Remove every highlight mark, restoring the original text nodes. */
export function clearMarks(root: Element) {
  for (const mark of Array.from(root.querySelectorAll("mark[data-highlight-id]"))) {
    mark.replaceWith(...Array.from(mark.childNodes));
  }
  root.normalize();
}

/** Start offset of an anchor in the root's text, or null if it can't be found. */
export function startOf(root: Node, anchor: Anchor): number | null {
  return locate(buildIndex(root).text, anchor)?.start ?? null;
}
