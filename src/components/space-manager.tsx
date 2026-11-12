"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSpace,
  deleteSpace,
  linkGroupToSpace,
  unlinkGroupFromSpace,
} from "@/actions/spaces";
import type { BlipGroup, Space } from "@/db/schema";

type Props = {
  space: Space;
  linkedGroups: BlipGroup[];
  availableGroups: BlipGroup[];
};

export function SpaceManager({ space, linkedGroups, availableGroups }: Props) {
  const router = useRouter();
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [autoIntake, setAutoIntake] = useState(space.autoIntake);
  const [groupToLink, setGroupToLink] = useState("");
  const [isPending, startTransition] = useTransition();

  function pulledMessage(base: string, pulled: number) {
    return pulled ? `${base}; stored ${pulled} blip${pulled === 1 ? "" : "s"}` : base;
  }

  function handleSave() {
    startTransition(async () => {
      const r = await updateSpace(space.id, { name, description, autoIntake });
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
    <div className="space-y-6 rounded-xl border p-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="sp-name">Name</Label>
          <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
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
        <Button size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
          Save
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Linked topic groups</h2>
        <p className="text-xs text-muted-foreground">
          Blips the AI puts in a linked group are stored here on import
          (when auto-intake is on). A group named like this space links automatically.
        </p>
        {linkedGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">None linked.</p>
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
            <Button size="sm" variant="outline" onClick={handleLink} disabled={isPending || !groupToLink}>
              Link
            </Button>
          </div>
        )}
      </div>

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
  );
}
