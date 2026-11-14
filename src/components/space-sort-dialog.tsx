"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { spaceSorts, spaceSortLabels, type SpaceSort } from "@/lib/space-sort";

export function SpaceSortDialog({ current }: { current: SpaceSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function choose(sort: SpaceSort) {
    setOpen(false);
    router.push(sort === "newest" ? pathname : `${pathname}?sort=${sort}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="size-4" />
          Sort
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sort blips</DialogTitle>
          <DialogDescription>
            Currently: {spaceSortLabels[current]}.
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex flex-col gap-2"
          role="radiogroup"
          aria-label="Sort order"
        >
          {spaceSorts.map((s) => (
            <Button
              key={s}
              role="radio"
              aria-checked={s === current}
              variant={s === current ? "default" : "outline"}
              className="justify-start"
              onClick={() => choose(s)}
            >
              {spaceSortLabels[s]}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
