"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSpace } from "@/actions/spaces";

export function SpaceCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [autoIntake, setAutoIntake] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createSpace({ name, description, autoIntake });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.pulled
          ? `Space created; pulled in ${result.pulled} existing blip${result.pulled === 1 ? "" : "s"}`
          : "Space created"
      );
      setName("");
      setDescription("");
      router.push(`/spaces/${result.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <Label htmlFor="space-name">New space</Label>
        <Input
          id="space-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Obituaries"
          maxLength={100}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="space-description">Description (optional)</Label>
        <Input
          id="space-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What belongs here"
          maxLength={500}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoIntake}
          onChange={(e) => setAutoIntake(e.target.checked)}
        />
        Auto-intake: store blips from linked topic groups automatically
      </label>
      <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
        <Plus className="size-4" />
        Create space
      </Button>
    </form>
  );
}
