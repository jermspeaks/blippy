"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSpaceFromGroup, routeGroupToSpace } from "@/actions/spaces";
import type { Space, SpaceKind } from "@/db/schema";

const plural = (n: number) => `${n} blip${n === 1 ? "" : "s"}`;

/** Triage actions for a topic group in the feed: make it a space, or file it in one. */
export function GroupActions({
  groupId,
  label,
  spaces,
}: {
  groupId: string;
  label: string;
  spaces: Space[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"create" | "move" | null>(null);
  const [name, setName] = useState(label);
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<SpaceKind>("general");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createSpaceFromGroup(groupId, {
        name,
        description,
        kind,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Created "${name.trim()}" with ${plural(r.moved)}`);
      setMode(null);
      router.refresh();
    });
  }

  function handleMove(space: Space) {
    startTransition(async () => {
      const r = await routeGroupToSpace(groupId, space.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Moved ${plural(r.moved)} to ${r.spaceName}`);
      setMode(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="ml-auto flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("create")}
          disabled={isPending}
        >
          <FolderPlus className="size-3" />
          Create space
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode("move")}
          disabled={isPending}
        >
          <Archive className="size-3" />
          Move to space
        </Button>
      </div>

      <Dialog
        open={mode === "create"}
        onOpenChange={(o) => !o && setMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a space from “{label}”</DialogTitle>
            <DialogDescription>
              All of this group&apos;s blips move into the new space, and future
              captures on this topic route there automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="gs-name">Name</Label>
              <Input
                id="gs-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gs-desc">Description</Label>
              <Input
                id="gs-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What belongs here (the AI uses this to route new links)"
                maxLength={500}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gs-kind">Kind</Label>
              <select
                id="gs-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as SpaceKind)}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="general">General</option>
                <option value="video">Video</option>
              </select>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !name.trim()}
            >
              Create space
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "move"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move “{label}” to a space</DialogTitle>
            <DialogDescription>
              All of this group&apos;s blips move there, and future captures on
              this topic route there automatically.
            </DialogDescription>
          </DialogHeader>
          {spaces.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No spaces yet. Create one instead.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {spaces.map((space) => (
                <li key={space.id}>
                  <Button
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-0.5 py-2 text-left"
                    onClick={() => handleMove(space)}
                    disabled={isPending}
                  >
                    <span>{space.name}</span>
                    {space.description && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {space.description}
                      </span>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
