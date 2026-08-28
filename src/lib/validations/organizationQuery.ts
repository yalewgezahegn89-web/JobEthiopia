import { z } from "zod";

const organizationStatusValues = ["ACTIVE", "INACTIVE"] as const;

export const organizationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(organizationStatusValues).optional(),
  locationId: z.string().uuid().optional(),
  isVerified: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

export type OrganizationListQuery = z.infer<typeof organizationListQuerySchema>;

export const organizationIdParamSchema = z.object({
  id: z.string().uuid("Invalid organization ID"),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;
