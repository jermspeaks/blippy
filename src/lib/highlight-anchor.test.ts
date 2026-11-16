import { describe, it, expect } from "vitest";
import { applyMark, buildIndex, clearMarks, describeRange, locate } from "./highlight-anchor";

function article(html: string) {
  const root = document.createElement("article");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}
function rangeOver(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  return r;
}

describe("describeRange", () => {
  it("captures the selected text with surrounding context", () => {
    const root = article("<p>The quick brown fox jumps over the lazy dog.</p>");
    const t = root.querySelector("p")!.firstChild!;
    const a = describeRange(root, rangeOver(t, 4, t, 19))!; // "quick brown fox"
    expect(a.exact).toBe("quick brown fox");
    expect(a.prefix).toBe("The ");
    expect(a.suffix.startsWith(" jumps")).toBe(true);
  });

  it("spans elements, trims whitespace, and rejects empty or huge selections", () => {
    const root = article("<p>First <em>part</em> here.</p><p>Second line.</p>");
    const p1 = root.querySelectorAll("p")[0];
    const p2 = root.querySelectorAll("p")[1];
    const a = describeRange(root, rangeOver(p1.firstChild!, 0, p2.firstChild!, 6))!;
    expect(a.exact).toBe("First part here.Second");
    const t = p1.firstChild!;
    expect(describeRange(root, rangeOver(t, 5, t, 6))).toBeNull(); // only a space
    const big = article(`<p>${"word ".repeat(600)}</p>`);
    const bt = big.querySelector("p")!.firstChild!;
    expect(describeRange(big, rangeOver(bt, 0, bt, 2500))).toBeNull();
  });
});

describe("locate", () => {
  it("finds a quote, and uses context to pick the right repeat", () => {
    const text = "alpha beta. gamma beta. delta beta. epsilon";
    expect(locate(text, { exact: "gamma", prefix: "", suffix: "" })).toEqual({ start: 12, end: 17 });
    const second = locate(text, { exact: "beta", prefix: "gamma ", suffix: ". delta" })!;
    expect(text.slice(second.start - 6, second.start)).toBe("gamma ");
    const third = locate(text, { exact: "beta", prefix: "delta ", suffix: ". epsilon" })!;
    expect(third.start).toBe(text.lastIndexOf("beta"));
  });

  it("returns null when the text is gone", () => {
    expect(locate("something else entirely", { exact: "missing", prefix: "", suffix: "" })).toBeNull();
  });
});

describe("applyMark / clearMarks", () => {
  it("wraps each text node piece, keeps the text, skips block whitespace, and clears cleanly", () => {
    const root = article("<p>Hello <b>big</b> world</p>\n<p>Next paragraph</p>");
    const before = root.textContent;
    const { text } = buildIndex(root);
    const start = text.indexOf("lo ");
    const end = text.indexOf("Next") + 4;
    const n = applyMark(root, start, end, { id: "h1", color: "green", hasNote: true });
    expect(n).toBeGreaterThanOrEqual(4);
    const marks = root.querySelectorAll("mark[data-highlight-id='h1']");
    expect([...marks].every((m) => (m as HTMLElement).dataset.color === "green")).toBe(true);
    expect([...marks].map((m) => m.textContent).join("")).toBe("lo big world" + "Next");
    expect(root.textContent).toBe(before);
    expect((marks[0] as HTMLElement).dataset.hasNote).toBe("true");

    clearMarks(root);
    expect(root.querySelectorAll("mark").length).toBe(0);
    expect(root.textContent).toBe(before);
    expect(root.querySelector("p")!.childNodes.length).toBe(3); // text, <b>, text: merged back
  });

  it("round trips: describe a selection, then locate and mark it again", () => {
    const html = "<p>One two three.</p><p>Two three four.</p>";
    const a = article(html);
    const t = a.querySelectorAll("p")[1].firstChild!;
    const d = describeRange(a, rangeOver(t, 0, t, 9))!; // "Two three"
    const fresh = article(html);
    const hit = locate(buildIndex(fresh).text, d)!;
    applyMark(fresh, hit.start, hit.end, { id: "x", color: "yellow", hasNote: false });
    const m = fresh.querySelector("mark")!;
    expect(m.textContent).toBe("Two three");
    expect(fresh.querySelectorAll("p")[1].contains(m)).toBe(true);
  });
});
