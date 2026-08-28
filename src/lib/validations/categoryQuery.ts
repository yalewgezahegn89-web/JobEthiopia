import { z } from "zod";

export const categoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  parentId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;

export const categoryIdParamSchema = z.object({
  id: z.string().uuid("Invalid category ID"),
});

export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;
