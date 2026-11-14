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

/**
 * Sort picker that stores the choice in the `?sort=` URL param, so the
 * server-rendered page re-sorts. The default option leaves the URL clean.
 */
export function SortDialog({
  current,
  options,
  defaultValue,
  title = "Sort",
}: {
  current: string;
  options: Record<string, string>;
  defaultValue: string;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function choose(value: string) {
    setOpen(false);
    router.push(
      value === defaultValue ? pathname : `${pathname}?sort=${value}`
    );
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Currently: {options[current]}.</DialogDescription>
        </DialogHeader>
        <div
          className="flex flex-col gap-2"
          role="radiogroup"
          aria-label="Sort order"
        >
          {Object.entries(options).map(([value, label]) => (
            <Button
              key={value}
              role="radio"
              aria-checked={value === current}
              variant={value === current ? "default" : "outline"}
              className="justify-start"
              onClick={() => choose(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
