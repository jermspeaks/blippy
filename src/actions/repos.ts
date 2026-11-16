"use server";

import { db } from "@/db";
import { blips } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hydratePendingRepos, hydrateRepos, pendingRepoBlips } from "@/lib/repo-hydrate";

function revalidateSpace(spaceId: string | null) {
  revalidatePath("/");
  revalidatePath("/spaces");
  if (spaceId) revalidatePath(`/spaces/${spaceId}`);
}

/** Look up details for blips in this code space that were never looked up. */
export async function fetchMissingRepoDetails(spaceId: string) {
  const attempted = pendingRepoBlips(50, spaceId).length;
  const counts = await hydratePendingRepos(50, spaceId);
  revalidateSpace(spaceId);
  return { ok: true as const, attempted, found: counts.ok, failed: counts.failed, deferred: counts.deferred };
}

/** Retry the lookup for one repository. */
export async function refreshRepo(blipId: string) {
  const [blip] = await db.select().from(blips).where(eq(blips.id, blipId)).limit(1);
  if (!blip) return { ok: false as const, error: "Blip not found" };
  const counts = await hydrateRepos([blip]);
  revalidateSpace(blip.spaceId);
  if (counts.deferred > 0) {
    return { ok: false as const, error: "The code host is busy or rate limiting. Try again in a bit." };
  }
  return { ok: true as const, found: counts.ok > 0 };
}
