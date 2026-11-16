"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Code2, Settings, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSpace,
  deleteSpace,
  linkGroupToSpace,
  unlinkGroupFromSpace,
  convertSpaceToBook,
  convertSpaceToCode,
} from "@/actions/spaces";
import type { BlipGroup, Space } from "@/db/schema";

type Props = {
  space: Space;
  linkedGroups: BlipGroup[];
  availableGroups: BlipGroup[];
};

export function SpaceManager({ space, linkedGroups, availableGroups }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [autoIntake, setAutoIntake] = useState(space.autoIntake);
  const [aiRouting, setAiRouting] = useState(space.aiRouting);
  const [groupToLink, setGroupToLink] = useState("");
  const [isPending, startTransition] = useTransition();

  function pulledMessage(base: string, pulled: number) {
    return pulled
      ? `${base}; stored ${pulled} blip${pulled === 1 ? "" : "s"}`
      : base;
  }

  function handleSave() {
    startTransition(async () => {
      const r = await updateSpace(space.id, {
        name,
        description,
        autoIntake,
        aiRouting,
      });
      if (r.ok) toast.success(pulledMessage("Saved", r.pulled));
      else toast.error(r.error);
      router.refresh();
    });
  }

  function handleLink() {
    if (!groupToLink) return;
    startTransition(async () => {
      const r = await linkGroupToSpace(space.id, groupToLink);
      if (r.ok) toast.success(pulledMessage("Group linked", r.pulled));
      else toast.error(r.error);
      setGroupToLink("");
      router.refresh();
    });
  }

  function handleUnlink(groupId: string) {
    startTransition(async () => {
      await unlinkGroupFromSpace(space.id, groupId);
      toast.success("Group unlinked (stored blips stay here)");
      router.refresh();
    });
  }

  function handleConvert() {
    if (
      !window.confirm(
        `Convert "${space.name}" to a book space? It keeps its blips and groups, shows them as book cards, and book links route here. This can't be undone.`
      )
    )
      return;
    startTransition(async () => {
      const r = await convertSpaceToBook(space.id);
      if (r.ok) toast.success(pulledMessage("Converted to a book space", r.pulled));
      else toast.error(r.error);
      router.refresh();
    });
  }

  function handleConvertToCode() {
    if (
      !window.confirm(
        `Convert "${space.name}" to a code space? It keeps its blips and groups, shows them as repository cards, and repository links with no better-fitting space route here. This can't be undone.`
      )
    )
      return;
    startTransition(async () => {
      const r = await convertSpaceToCode(space.id);
      if (r.ok) toast.success(pulledMessage("Converted to a code space", r.pulled));
      else toast.error(r.error);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Delete "${space.name}"? Its blips return to the feed and its groups are unlinked.`
      )
    )
      return;
    startTransition(async () => {
      await deleteSpace(space.id);
      toast.success("Space deleted");
      router.push("/spaces");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="size-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit space</DialogTitle>
          <DialogDescription>
            Name, intake and linked topic groups.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sp-name">Name</Label>
              <Input
                id="sp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sp-desc">Description</Label>
              <Input
                id="sp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoIntake}
                onChange={(e) => setAutoIntake(e.target.checked)}
              />
              Auto-intake from linked topic groups
            </label>
            {space.kind !== "video" && (
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={aiRouting}
                    onChange={(e) => setAiRouting(e.target.checked)}
                  />
                  Let the AI route new links here
                </label>
                <p className="text-muted-foreground mt-1 pl-6 text-xs">
                  Uses this space&apos;s name and description. Requires
                  auto-intake. Linked topic groups still route here when off.
                </p>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !name.trim()}
            >
              Save
            </Button>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium">Linked topic groups</h2>
            <p className="text-muted-foreground text-xs">
              Blips the AI puts in a linked group are stored here on import
              (when auto-intake is on). A group named like this space links
              automatically.
            </p>
            {linkedGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">None linked.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {linkedGroups.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                  >
                    {g.label}
                    <button
                      type="button"
                      onClick={() => handleUnlink(g.id)}
                      disabled={isPending}
                      aria-label={`Unlink ${g.label}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Unlink className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {availableGroups.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={groupToLink}
                  onChange={(e) => setGroupToLink(e.target.value)}
                  aria-label="Group to link"
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Link a topic group…</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLink}
                  disabled={isPending || !groupToLink}
                >
                  Link
                </Button>
              </div>
            )}
          </div>

          {space.kind === "general" && (
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvert}
                disabled={isPending}
              >
                <BookOpen className="size-4" />
                Convert to book space
              </Button>
              <p className="text-muted-foreground text-xs">
                Shows blips as book cards (cover, title, author) and routes book
                links here.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvertToCode}
                disabled={isPending}
              >
                <Code2 className="size-4" />
                Convert to code space
              </Button>
              <p className="text-muted-foreground text-xs">
                Shows blips as repository cards (description, language, stars,
                topics). Repository links go here when no other space fits.
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete space
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
