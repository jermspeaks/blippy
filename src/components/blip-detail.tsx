"use client";

import { useState } from "react";
import type { Blip, Category } from "@/db/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateBlipSchema, type UpdateBlipInput } from "@/lib/validations";
import { updateBlip, snoozeBlip, setBlipFizzled } from "@/actions/blips";
import { createCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CREATE_NEW_SENTINEL = "__create__";

export function BlipDetail({
  blip,
  categories,
}: {
  blip: Blip;
  categories: Category[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const extraIds = new Set(extraCategories.map((c) => c.id));
  const displayCategories = [
    ...extraCategories,
    ...categories.filter(
      (c) => c.id !== "uncategorized" && !extraIds.has(c.id)
    ),
  ];

  const form = useForm<UpdateBlipInput>({
    resolver: zodResolver(updateBlipSchema),
    defaultValues: {
      content: blip.content,
      categoryId: blip.categoryId ?? null,
      status: blip.status,
    },
  });

  async function onSubmit(data: UpdateBlipInput) {
    const formData = new FormData();
    if (data.content !== undefined) formData.set("content", data.content);
    if (data.categoryId !== undefined)
      formData.set("categoryId", data.categoryId ?? "");
    if (data.status !== undefined) formData.set("status", data.status);

    const result = await updateBlip(blip.id, formData);
    if (result.ok) {
      toast.success("Blip updated");
    } else {
      toast.error("Failed to update");
    }
  }

  function handleSnooze() {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    startTransition(async () => {
      const result = await snoozeBlip(blip.id, next);
      if (result.ok) toast.success("Snoozed until tomorrow");
      else toast.error("Failed to snooze");
    });
  }

  function handleFizzle() {
    startTransition(async () => {
      const result = await setBlipFizzled(blip.id);
      if (result.ok) {
        toast.success("Blip fizzled");
        window.location.href = "/";
      } else toast.error("Failed to fizzle");
    });
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Enter a category name");
      return;
    }
    setIsCreatingCategory(true);
    const result = await createCategory(name);
    setIsCreatingCategory(false);
    if (result.ok) {
      setExtraCategories((prev) => [...prev, result.category]);
      form.setValue("categoryId", result.category.id);
      setCreateDialogOpen(false);
      setNewCategoryName("");
      router.refresh();
    } else {
      const err = result.error;
      toast.error(err?.fieldErrors?.name?.[0] ?? "Failed to create category");
    }
  }

  const categoryName =
    categories.find((c) => c.id === blip.categoryId)?.name ?? "Uncategorized";

  return (
    <div className="space-y-6">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link href="/" className="hover:underline">
          Feed
        </Link>
        <span>/</span>
        <span>Blip</span>
      </div>

      <Card>
        <CardHeader>
          <p className="text-muted-foreground text-sm font-medium">
            {categoryName} · {blip.status}
          </p>
          <p className="text-muted-foreground text-sm">
            Created {blip.createdAt?.toLocaleDateString() ?? ""} · Next review{" "}
            {blip.nextReviewAt?.toLocaleDateString() ?? "—"}
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <select
                        className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === CREATE_NEW_SENTINEL) {
                            setCreateDialogOpen(true);
                            field.onChange(field.value ?? null);
                          } else {
                            field.onChange(v === "" ? null : v);
                          }
                        }}
                      >
                        <option value="">Uncategorized</option>
                        {displayCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value={CREATE_NEW_SENTINEL}>
                          Create new category…
                        </option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSnooze}
            disabled={isPending}
            className="inline-flex items-center gap-1"
          >
            <CalendarClock className="size-3" />
            Snooze 1 day
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFizzle}
            disabled={isPending}
            className="text-destructive hover:text-destructive inline-flex items-center gap-1"
          >
            <X className="size-3" />
            Fizzle
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setNewCategoryName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="blip-detail-new-category-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="blip-detail-new-category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewCategoryName("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              disabled={isCreatingCategory}
            >
              {isCreatingCategory ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
