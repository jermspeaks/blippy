"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBook } from "@/actions/books";
import type { Blip, BookDetails } from "@/db/schema";
import { parseAuthors } from "@/components/book-card";

const orNull = (s: string) => (s.trim() ? s.trim() : null);
const numOrNull = (s: string) => (s.trim() ? Number(s) : null);

export function EditBookDialog({
  blip,
  book,
}: {
  blip: Blip;
  book: BookDetails | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initial = () => ({
    title: blip.title ?? blip.content.slice(0, 120),
    authors: parseAuthors(book?.authors).join(", "),
    coverUrl: blip.imageUrl ?? "",
    url: blip.url ?? "",
    publisher: book?.publisher ?? "",
    publishedYear: book?.publishedYear?.toString() ?? "",
    pageCount: book?.pageCount?.toString() ?? "",
    isbn13: book?.isbn13 ?? "",
  });
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updateBook(blip.id, {
        title: f.title,
        authors: f.authors.split(",").map((a) => a.trim()).filter(Boolean),
        coverUrl: orNull(f.coverUrl),
        url: orNull(f.url),
        publisher: orNull(f.publisher),
        publishedYear: numOrNull(f.publishedYear),
        pageCount: numOrNull(f.pageCount),
        isbn13: orNull(f.isbn13),
      });
      if (r.ok) {
        toast.success("Book updated");
        setOpen(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`eb-${k}`}>{label}</Label>
      <Input id={`eb-${k}`} type={type} value={f[k]} onChange={set(k)} />
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(initial());
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Edit book"
          title="Edit book"
        >
          <Pencil className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit book</DialogTitle>
          <DialogDescription>
            Change the title, cover or details. Looking the book up again will
            replace your edits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          {field("title", "Title")}
          {field("authors", "Authors (comma separated)")}
          {field("coverUrl", "Cover image link (https)", "url")}
          {field("url", "Book link (https)", "url")}
          <div className="grid grid-cols-2 gap-3">
            {field("publisher", "Publisher")}
            {field("isbn13", "ISBN-13")}
            {field("publishedYear", "Year", "number")}
            {field("pageCount", "Pages", "number")}
          </div>
          <Button type="submit" disabled={isPending || !f.title.trim()}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
