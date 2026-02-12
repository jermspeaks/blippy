"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { createCategorySchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { Category } from "@/db/schema";

const UNCATEGORIZED_ID = "uncategorized";
const MAX_SLUG_LENGTH = 100;

function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, MAX_SLUG_LENGTH) || "category";
}

export async function createCategory(name: string) {
  const parsed = createCategorySchema.safeParse({ name });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }

  const baseSlug = slugFromName(parsed.data.name);
  let id = baseSlug === "" || baseSlug === UNCATEGORIZED_ID ? "category" : baseSlug;

  const existingIds = await db
    .select({ id: categories.id })
    .from(categories);
  const idSet = new Set(existingIds.map((r) => r.id));

  if (idSet.has(id)) {
    let n = 2;
    while (idSet.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }

  const now = new Date();
  const [inserted] = await db
    .insert(categories)
    .values({
      id,
      name: parsed.data.name.trim(),
      createdAt: now,
    })
    .returning();

  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/capture");

  return { ok: true as const, category: inserted };
}
