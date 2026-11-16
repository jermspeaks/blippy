"use client";

import type { Blip } from "@/db/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateBlipSchema, type UpdateBlipInput } from "@/lib/validations";
import { updateBlip, setBlipFizzled } from "@/actions/blips";
import { SnoozeMenu } from "@/components/snooze-menu";
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { ReadLaterButton } from "@/components/read-later-button";

export function BlipDetail({
  blip,
  readingItemId = null,
}: {
  blip: Blip;
  readingItemId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateBlipInput>({
    resolver: zodResolver(updateBlipSchema),
    defaultValues: {
      content: blip.content,
      status: blip.status,
    },
  });

  async function onSubmit(data: UpdateBlipInput) {
    const formData = new FormData();
    if (data.content !== undefined) formData.set("content", data.content);
    if (data.status !== undefined) formData.set("status", data.status);

    const result = await updateBlip(blip.id, formData);
    if (result.ok) {
      toast.success("Blip updated");
    } else {
      toast.error("Failed to update");
    }
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
            {blip.status}
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex gap-2">
          <SnoozeMenu blipId={blip.id} label="Snooze" />
          {blip.url && <ReadLaterButton blipId={blip.id} readingItemId={readingItemId} />}
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
    </div>
  );
}
