"use client";

import type { Blip, Category } from "@/db/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateBlipSchema, type UpdateBlipInput } from "@/lib/validations";
import { updateBlip, snoozeBlip, setBlipFizzled } from "@/actions/blips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { CalendarClock, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";

export function BlipDetail({
  blip,
  categories,
}: {
  blip: Blip;
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();
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

  const categoryName =
    categories.find((c) => c.id === blip.categoryId)?.name ?? "Uncategorized";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Feed
        </Link>
        <span>/</span>
        <span>Blip</span>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">
            {categoryName} · {blip.status}
          </p>
          <p className="text-sm text-muted-foreground">
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
                      <Input {...field} value={field.value ?? ""} />
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
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : e.target.value
                          )
                        }
                      >
                        <option value="">Uncategorized</option>
                        {categories
                          .filter((c) => c.id !== "uncategorized")
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
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
            className="inline-flex items-center gap-1 text-destructive hover:text-destructive"
          >
            <X className="size-3" />
            Fizzle
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
