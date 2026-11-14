"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRoutingRule, deleteRoutingRule } from "@/actions/routing";
import { offerReroute } from "@/components/reroute";

type Rule = { id: string; pattern: string; spaceId: string; spaceName: string };
type SpaceOption = { id: string; name: string };

export function RoutingRules({
  rules,
  spaces,
}: {
  rules: Rule[];
  spaces: SpaceOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pattern, setPattern] = useState("");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createRoutingRule({ pattern, spaceId });
      if (r.ok) {
        toast.success(`Links from ${r.pattern} now go to that space`);
        setPattern("");
        router.refresh();
        void offerReroute(router);
      } else toast.error(r.error);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRoutingRule(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">No domain rules yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span>
                <code className="font-medium">{r.pattern}</code>
                <span className="text-muted-foreground"> → {r.spaceName}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(r.id)}
                disabled={isPending}
                aria-label={`Delete rule ${r.pattern}`}
              >
                <Trash2 className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {spaces.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Create a space first to add a rule.
        </p>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="github.com or github.com/vercel"
            aria-label="Site pattern"
            className="w-64"
          />
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            aria-label="Space"
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={isPending || !pattern.trim()}>
            Add rule
          </Button>
        </form>
      )}
    </div>
  );
}
