import { z } from "zod";
import { blipStatuses } from "@/db/schema";

export const createBlipSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  categoryId: z.string().optional().nullable(),
});

export const updateBlipSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000).optional(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(blipStatuses).optional(),
});

export const snoozeBlipSchema = z.object({
  nextReviewAt: z.coerce.date(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export type CreateBlipInput = z.infer<typeof createBlipSchema>;
export type UpdateBlipInput = z.infer<typeof updateBlipSchema>;
export type SnoozeBlipInput = z.infer<typeof snoozeBlipSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
