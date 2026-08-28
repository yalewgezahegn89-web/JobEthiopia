import { z } from "zod";

const locationTypeValues = ["COUNTRY", "REGION", "CITY", "DISTRICT", "OTHER"] as const;

export const locationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(locationTypeValues).optional(),
  parentId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export type LocationListQuery = z.infer<typeof locationListQuerySchema>;

export const locationIdParamSchema = z.object({
  id: z.string().uuid("Invalid location ID"),
});

export type LocationIdParam = z.infer<typeof locationIdParamSchema>;
