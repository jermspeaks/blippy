"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBlipSchema, type CreateBlipInput } from "@/lib/validations";
import { createBlip } from "@/actions/blips";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Category } from "@/db/schema";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function BlipForm({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
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
    if (data.categoryId != null) formData.set("categoryId", data.categoryId);

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
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
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
          {form.formState.isSubmitting ? "Capturing…" : "Capture"}
        </Button>
      </form>
    </Form>
  );
}
