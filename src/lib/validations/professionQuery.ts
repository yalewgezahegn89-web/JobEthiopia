import { z } from "zod";

export const professionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export type ProfessionListQuery = z.infer<typeof professionListQuerySchema>;

export const professionIdParamSchema = z.object({
  id: z.string().uuid("Invalid profession ID"),
});

export type ProfessionIdParam = z.infer<typeof professionIdParamSchema>;
