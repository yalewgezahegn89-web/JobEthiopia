import { z } from "zod";

const jobStatusValues = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "EXPIRED",
  "REMOVED",
] as const;

const employmentTypeValues = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "VOLUNTEER",
  "FREELANCE",
  "OTHER",
] as const;

export const jobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(jobStatusValues).optional(),
  employmentType: z.enum(employmentTypeValues).optional(),
  organizationId: z.string().uuid().optional(),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const jobIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;
