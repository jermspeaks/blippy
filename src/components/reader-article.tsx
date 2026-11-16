"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Highlighter, MessageSquarePlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createHighlight, deleteHighlight, updateHighlight } from "@/actions/highlights";
import {
  applyMark,
  buildIndex,
  clearMarks,
  describeRange,
  locate,
  type Anchor,
} from "@/lib/highlight-anchor";
import { highlightColors, type HighlightColor, type ReadingHighlight } from "@/db/schema";
import { cn } from "@/lib/utils";

const swatch: Record<HighlightColor, string> = {
  yellow: "bg-yellow-300",
  green: "bg-green-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300",
};

type Draft =
  | { kind: "new"; anchor: Anchor }
  | { kind: "edit"; highlight: ReadingHighlight };

function HighlightDialog({
  itemId,
  draft,
  onClose,
  onSaved,
  onDeleted,
}: {
  itemId: string;
  draft: Draft | null;
  onClose: () => void;
  onSaved: (h: ReadingHighlight, isNew: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [note, setNote] = useState("");
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [seen, setSeen] = useState<Draft | null>(null);

  // Reset the form each time a different highlight is opened.
  if (draft !== seen) {
    setSeen(draft);
    setNote(draft?.kind === "edit" ? (draft.highlight.note ?? "") : "");
    setColor(draft?.kind === "edit" ? draft.highlight.color : "yellow");
    setConfirmDelete(false);
  }

  const quote = draft?.kind === "edit" ? draft.highlight.exact : (draft?.anchor.exact ?? "");

  function save() {
    if (!draft) return;
    startTransition(async () => {
      if (draft.kind === "new") {
        const r = await createHighlight({
          readingItemId: itemId,
          ...draft.anchor,
          note,
          color,
        });
        if (r.ok) onSaved(r.highlight, true);
        else toast.error(r.error);
      } else {
        const r = await updateHighlight(draft.highlight.id, { note: note.trim() || null, color });
        if (r.ok) onSaved(r.highlight, false);
        else toast.error(r.error);
      }
    });
  }

  function remove() {
    if (draft?.kind !== "edit") return;
    const id = draft.highlight.id;
    startTransition(async () => {
      await deleteHighlight(id);
      toast.success("Highlight deleted");
      onDeleted(id);
    });
  }

  const hasNote = draft?.kind === "edit" && !!draft.highlight.note;

  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.kind === "edit" ? "Edit highlight" : "Highlight with a note"}</DialogTitle>
          <DialogDescription className="line-clamp-4 italic">&ldquo;{quote}&rdquo;</DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={4}
          maxLength={2000}
          aria-label="Note"
        />
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Color">
          {highlightColors.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn("size-6 rounded-full border-2", swatch[c], color === c ? "border-foreground" : "border-transparent")}
            />
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          {draft?.kind === "edit" ? (
            confirmDelete ? (
              <Button variant="destructive" disabled={isPending} onClick={remove}>
                {hasNote ? "Delete highlight and its note?" : "Confirm delete"}
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" disabled={isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={save}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The saved article with highlights: select text to highlight it (optionally
 * with a note), click a highlight to edit it, and see them all in a list.
 * Highlights are stored as text anchors and re-applied as <mark>s on load.
 */
export function ReaderArticle({
  itemId,
  html,
  initialHighlights,
}: {
  itemId: string;
  html: string;
  initialHighlights: ReadingHighlight[];
}) {
  const ref = useRef<HTMLElement>(null);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [positions, setPositions] = useState<Record<string, number | null>>({});
  const [toolbar, setToolbar] = useState<{ x: number; y: number; anchor: Anchor } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [, startTransition] = useTransition();
  // React re-sets innerHTML on a re-render whenever this object's identity changes, which would
  // wipe the <mark>s added below. Keeping it stable leaves the DOM alone.
  const innerHtml = useMemo(() => ({ __html: html }), [html]);

  // (Re)apply every highlight whenever the list changes. Marks are removed first, so this is idempotent.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    clearMarks(root);
    const text = buildIndex(root).text;
    const next: Record<string, number | null> = {};
    for (const h of highlights) {
      const hit = locate(text, h);
      next[h.id] = hit ? hit.start : null;
      if (hit) applyMark(root, hit.start, hit.end, { id: h.id, color: h.color, hasNote: !!h.note });
    }
    setPositions(next);
  }, [highlights]);

  // Show the highlight toolbar when text inside the article is selected.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scroller = root.closest("main");
    const check = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setToolbar(null);
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setToolbar(null);
      const overlaps = Array.from(root.querySelectorAll("mark[data-highlight-id]")).some((m) =>
        range.intersectsNode(m)
      );
      if (overlaps) return setToolbar(null);
      const d = describeRange(root, range);
      if (!d) return setToolbar(null);
      const rect = range.getBoundingClientRect();
      setToolbar({
        x: Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120),
        y: rect.top,
        anchor: { exact: d.exact, prefix: d.prefix, suffix: d.suffix },
      });
    };
    const later = () => setTimeout(check, 0);
    const hide = () => setToolbar(null);
    const onSelectionChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) setToolbar(null);
    };
    document.addEventListener("mouseup", later);
    document.addEventListener("keyup", later);
    document.addEventListener("touchend", later);
    document.addEventListener("selectionchange", onSelectionChange);
    scroller?.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("mouseup", later);
      document.removeEventListener("keyup", later);
      document.removeEventListener("touchend", later);
      document.removeEventListener("selectionchange", onSelectionChange);
      scroller?.removeEventListener("scroll", hide);
    };
  }, []);

  function addHighlight(anchor: Anchor, color: HighlightColor) {
    startTransition(async () => {
      const r = await createHighlight({ readingItemId: itemId, ...anchor, color });
      if (r.ok) setHighlights((hs) => [...hs, r.highlight]);
      else toast.error(r.error);
    });
    document.getSelection()?.removeAllRanges();
    setToolbar(null);
  }

  function openFromClick(e: React.MouseEvent) {
    const mark = (e.target as HTMLElement).closest?.("mark[data-highlight-id]");
    if (!mark || !document.getSelection()?.isCollapsed) return;
    const h = highlights.find((x) => x.id === (mark as HTMLElement).dataset.highlightId);
    if (h) setDraft({ kind: "edit", highlight: h });
  }

  function jumpTo(id: string) {
    ref.current
      ?.querySelector(`mark[data-highlight-id="${id}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const ordered = [...highlights].sort(
    (a, b) => (positions[a.id] ?? Number.MAX_SAFE_INTEGER) - (positions[b.id] ?? Number.MAX_SAFE_INTEGER)
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">Select text to highlight it.</p>
        <Button variant="ghost" size="sm" aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
          <Highlighter className="size-4" />
          Highlights ({highlights.length})
        </Button>
      </div>
      {panelOpen && (
        <div className="bg-card mb-6 space-y-3 rounded-lg border p-3">
          {ordered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No highlights yet. Select some text in the article.</p>
          ) : (
            ordered.map((h) => (
              <div key={h.id} className="flex gap-2">
                <span className={cn("w-1 shrink-0 rounded-full", swatch[h.color])} />
                <div className="min-w-0 flex-1 text-sm">
                  {positions[h.id] === null ? (
                    <p className="line-clamp-3 italic">&ldquo;{h.exact}&rdquo;</p>
                  ) : (
                    <button type="button" className="line-clamp-3 text-left italic hover:underline" onClick={() => jumpTo(h.id)}>
                      &ldquo;{h.exact}&rdquo;
                    </button>
                  )}
                  {h.note && <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{h.note}</p>}
                  {positions[h.id] === null && (
                    <p className="text-destructive mt-1 text-xs">
                      Can&apos;t find this passage in the saved text (it may have changed after a refresh).
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Edit highlight"
                  title="Edit highlight"
                  onClick={() => setDraft({ kind: "edit", highlight: h })}
                >
                  <Pencil className="size-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
      {/* Sanitized at save time by sanitizeArticleHtml (src/lib/article.ts); only <mark>s are added here. */}
      <article
        ref={ref}
        className="reader-content"
        onClick={openFromClick}
        dangerouslySetInnerHTML={innerHtml}
      />
      {toolbar && (
        <div
          className="bg-popover text-popover-foreground fixed z-50 flex items-center gap-1 rounded-lg border p-1 shadow-md"
          style={{ left: toolbar.x, top: toolbar.y - 8, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {highlightColors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight ${c}`}
              title={`Highlight ${c}`}
              onClick={() => addHighlight(toolbar.anchor, c)}
              className={cn("size-6 rounded-full border", swatch[c])}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft({ kind: "new", anchor: toolbar.anchor });
              setToolbar(null);
            }}
          >
            <MessageSquarePlus className="size-4" />
            Note
          </Button>
        </div>
      )}
      <HighlightDialog
        itemId={itemId}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={(h, isNew) => {
          setHighlights((hs) => (isNew ? [...hs, h] : hs.map((x) => (x.id === h.id ? h : x))));
          document.getSelection()?.removeAllRanges();
          setDraft(null);
        }}
        onDeleted={(id) => {
          setHighlights((hs) => hs.filter((x) => x.id !== id));
          setDraft(null);
        }}
      />
    </div>
  );
}
