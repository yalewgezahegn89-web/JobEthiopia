import { z } from "zod";
import { EMPLOYMENT_TYPE_OPTIONS } from "@/lib/jobs/employmentTypes";

const jobStatusValues = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "EXPIRED",
  "REMOVED",
] as const;

export const jobSortValues = ["relevance", "newest", "deadline"] as const;

const salaryNumber = z.coerce
  .number()
  .refine((value) => Number.isFinite(value), {
    message: "must be a finite number",
  })
  .min(0, "must be a non-negative number");

export const jobListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(jobStatusValues).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPE_OPTIONS).optional(),
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    professionId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    q: z.string().trim().max(200).optional(),
    sort: z.enum(jobSortValues).optional(),
    salaryMin: salaryNumber.optional(),
    salaryMax: salaryNumber.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.salaryMin !== undefined &&
      data.salaryMax !== undefined &&
      data.salaryMin > data.salaryMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salaryMin"],
        message: "salaryMin must be less than or equal to salaryMax",
      });
    }
  });

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const jobIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;
