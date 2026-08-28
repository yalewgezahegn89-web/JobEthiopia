import { z } from "zod";

const sourceTypeValues = [
  "MANUAL",
  "WEBSITE",
  "API",
  "FEED",
  "EMPLOYER",
  "OTHER",
] as const;

export const sourceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  sourceType: z.enum(sourceTypeValues).optional(),
});

export type SourceListQuery = z.infer<typeof sourceListQuerySchema>;

export const dueListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceType: z.enum(sourceTypeValues).optional(),
  maxConsecutiveFailures: z.coerce.number().int().min(0).optional(),
});

export type DueListQuery = z.infer<typeof dueListQuerySchema>;
