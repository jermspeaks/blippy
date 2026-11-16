import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/actions/highlights", () => ({
  createHighlight: vi.fn(),
  updateHighlight: vi.fn(),
  deleteHighlight: vi.fn(async () => ({ ok: true })),
}));

import { createHighlight, deleteHighlight } from "@/actions/highlights";
import { ReaderArticle } from "./reader-article";
import type { ReadingHighlight } from "@/db/schema";

const html = "<p>The quick brown fox jumps over the lazy dog.</p><p>A second paragraph of text.</p>";
const hl = (o: Partial<ReadingHighlight> = {}): ReadingHighlight => ({
  id: "h1",
  readingItemId: "item",
  exact: "quick brown fox",
  prefix: "The ",
  suffix: " jumps over",
  note: null,
  color: "yellow",
  createdAt: new Date(),
  ...o,
});

beforeAll(() => {
  // jsdom has no layout; the toolbar only needs somewhere to sit.
  Range.prototype.getBoundingClientRect = () =>
    ({ left: 200, top: 120, width: 80, height: 20, right: 280, bottom: 140, x: 200, y: 120, toJSON() {} }) as DOMRect;
});
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.getSelection()?.removeAllRanges();
});

function select(text: string) {
  const p = [...document.querySelectorAll("article p")].find((n) => n.textContent?.includes(text))!;
  const node = p.firstChild as Text;
  const start = node.data.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const sel = document.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  act(() => {
    fireEvent.mouseUp(document);
  });
}

describe("ReaderArticle", () => {
  it("applies saved highlights as marks and lists them", async () => {
    render(<ReaderArticle itemId="item" html={html} initialHighlights={[hl({ note: "remember", color: "green" })]} />);
    const mark = await waitFor(() => {
      const m = document.querySelector("mark[data-highlight-id='h1']");
      expect(m).toBeTruthy();
      return m as HTMLElement;
    });
    expect(mark.textContent).toBe("quick brown fox");
    expect(mark.dataset.color).toBe("green");
    expect(mark.dataset.hasNote).toBe("true");
    expect(screen.getByRole("button", { name: /Highlights \(1\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Highlights \(1\)/ }));
    expect(await screen.findByText("remember")).toBeInTheDocument();
  });

  it("flags a highlight whose passage is no longer in the text", async () => {
    render(<ReaderArticle itemId="item" html={html} initialHighlights={[hl({ id: "gone", exact: "text that was removed" })]} />);
    fireEvent.click(screen.getByRole("button", { name: /Highlights \(1\)/ }));
    expect(await screen.findByText(/Can't find this passage/)).toBeInTheDocument();
    expect(document.querySelector("mark")).toBeNull();
  });

  it("selecting text offers colors and saves the chosen one with its anchor", async () => {
    vi.mocked(createHighlight).mockImplementation(async (input) => ({
      ok: true as const,
      highlight: { ...hl({ id: "new1" }), ...input, note: null, createdAt: new Date() } as ReadingHighlight,
    }));
    render(<ReaderArticle itemId="item" html={html} initialHighlights={[]} />);
    select("lazy dog");
    const pink = await screen.findByRole("button", { name: "Highlight pink" });
    await act(async () => {
      fireEvent.click(pink);
    });
    expect(createHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ readingItemId: "item", exact: "lazy dog", color: "pink", prefix: expect.stringContaining("over the ") })
    );
    await waitFor(() => expect(document.querySelector("mark[data-highlight-id='new1']")?.textContent).toBe("lazy dog"));
    expect(screen.queryByRole("button", { name: "Highlight pink" })).toBeNull();
  });

  it("does not offer the toolbar over an existing highlight", async () => {
    render(<ReaderArticle itemId="item" html={html} initialHighlights={[hl()]} />);
    await waitFor(() => expect(document.querySelector("mark")).toBeTruthy());
    const mark = document.querySelector("mark")!;
    const range = document.createRange();
    range.selectNodeContents(mark.parentElement!);
    document.getSelection()!.addRange(range);
    act(() => {
      fireEvent.mouseUp(document);
    });
    expect(screen.queryByRole("button", { name: "Highlight yellow" })).toBeNull();
  });

  it("clicking a highlight opens it for editing, and deleting a highlight with a note asks twice", async () => {
    render(<ReaderArticle itemId="item" html={html} initialHighlights={[hl({ note: "keep this" })]} />);
    const mark = await waitFor(() => {
      const m = document.querySelector("mark");
      expect(m).toBeTruthy();
      return m as HTMLElement;
    });
    fireEvent.click(mark);
    const note = await screen.findByLabelText("Note");
    expect((note as HTMLTextAreaElement).value).toBe("keep this");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteHighlight).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Delete highlight and its note\?/ }));
    });
    expect(deleteHighlight).toHaveBeenCalledWith("h1");
    await waitFor(() => expect(document.querySelector("mark")).toBeNull());
  });
});
