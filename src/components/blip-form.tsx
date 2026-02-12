"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBlipSchema, type CreateBlipInput } from "@/lib/validations";
import { createBlip } from "@/actions/blips";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category } from "@/db/schema";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const CREATE_NEW_SENTINEL = "__create__";

export function BlipForm({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const form = useForm<CreateBlipInput>({
    resolver: zodResolver(createBlipSchema),
    defaultValues: {
      content: "",
      categoryId: null,
    },
  });

  async function onSubmit(data: CreateBlipInput) {
    const formData = new FormData();
    formData.set("content", data.content);
    if (data.categoryId != null && data.categoryId !== CREATE_NEW_SENTINEL)
      formData.set("categoryId", data.categoryId);

    const result = await createBlip(formData);
    if (result.ok) {
      toast.success("Blip captured");
      form.reset();
      router.push("/");
    } else {
      toast.error("Failed to capture");
      const err = result.error;
      if (err?.fieldErrors?.content?.[0])
        form.setError("content", { message: err.fieldErrors.content[0] });
    }
  }

  const displayCategories = [
    ...extraCategories,
    ...categories.filter((c) => c.id !== "uncategorized"),
  ];

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What's on your mind?"
                  {...field}
                  value={field.value ?? ""}
                  className="min-h-[80px]"
                />
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          {form.formState.isSubmitting ? "Capturing…" : "Capture"}
        </Button>
      </form>

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
            <label htmlFor="new-category-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="new-category-name"
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
    </Form>
  );
}
