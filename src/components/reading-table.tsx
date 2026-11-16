"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Check, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setReadingStatus } from "@/actions/reading";
import { RemoveReadingDialog } from "@/components/remove-reading-dialog";
import type { ReadingStatus } from "@/db/schema";

export type ReadingRow = {
  id: string;
  title: string;
  siteName: string | null;
  byline: string | null;
  excerpt: string | null;
  readingMinutes: number | null;
  scrollPct: number;
  extractStatus: "ok" | "failed";
  extractError: string | null;
  status: ReadingStatus;
  addedAt: Date;
};

function Row({ item }: { item: ReadingRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function setStatus(status: ReadingStatus, message: string) {
    startTransition(async () => {
      const r = await setReadingStatus(item.id, status);
      if (r.ok) toast.success(message);
      else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="max-w-xl whitespace-normal">
        <Link href={`/reading/${item.id}`} className="font-medium hover:underline">
          {item.title}
        </Link>
        <p className="text-muted-foreground text-xs">
          {[item.siteName, item.byline].filter(Boolean).join(" · ")}
        </p>
        {item.extractStatus === "failed" ? (
          <p className="text-destructive inline-flex items-center gap-1 text-xs">
            <TriangleAlert className="size-3" />
            Text not saved: {item.extractError ?? "extraction failed"}
          </p>
        ) : (
          item.excerpt && <p className="text-muted-foreground line-clamp-2 text-sm">{item.excerpt}</p>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {item.readingMinutes ? `${item.readingMinutes} min` : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
        {item.status === "reading" && item.scrollPct > 0 ? `${Math.round(item.scrollPct * 100)}%` : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
        {item.addedAt.toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {item.status === "read" || item.status === "archived" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setStatus("unread", "Moved back to Unread")}
            title="Move back to Unread"
            aria-label="Move back to Unread"
          >
            <RotateCcw className="size-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setStatus("read", "Marked as read")}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <Check className="size-3" />
          </Button>
        )}
        {item.status !== "archived" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setStatus("archived", "Archived")}
            title="Archive"
            aria-label="Archive"
          >
            <Archive className="size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
          title="Delete"
          aria-label="Delete"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </Button>
        <RemoveReadingDialog
          id={item.id}
          title={item.title}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onRemoved={() => router.refresh()}
        />
      </TableCell>
    </TableRow>
  );
}

export function ReadingTable({ items }: { items: ReadingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Article</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Added</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <Row key={i.id} item={i} />
        ))}
      </TableBody>
    </Table>
  );
}
