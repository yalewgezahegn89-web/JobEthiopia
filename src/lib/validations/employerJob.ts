import { z } from "zod";

const EmploymentType = z.enum([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "VOLUNTEER",
  "FREELANCE",
  "OTHER",
]);
const SalaryPeriod = z.enum(["HOURLY", "DAILY", "MONTHLY", "YEARLY", "OTHER"]);

export const employerCreateJobSchema = z
  .object({
    organizationId: z.string().uuid("Organization ID must be a valid UUID"),
    title: z.string().min(1, "Title is required"),
    description: z.string().min(1, "Description is required"),
    categoryId: z.string().uuid().nullable().optional(),
    professionId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    responsibilities: z.string().nullable().optional(),
    requirements: z.string().nullable().optional(),
    educationRequirements: z.string().nullable().optional(),
    benefits: z.string().nullable().optional(),
    experienceMin: z.number().int().min(0).nullable().optional(),
    experienceMax: z.number().int().min(0).nullable().optional(),
    employmentType: EmploymentType.nullable().optional(),
    salaryMin: z.number().min(0).nullable().optional(),
    salaryMax: z.number().min(0).nullable().optional(),
    salaryCurrency: z.string().nullable().optional(),
    salaryPeriod: SalaryPeriod.nullable().optional(),
    postedAt: z.string().datetime().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    applicationUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMax >= data.salaryMin,
    {
      message: "salaryMax must be greater than or equal to salaryMin",
      path: ["salaryMax"],
    },
  )
  .refine(
    (data) =>
      data.experienceMin == null ||
      data.experienceMax == null ||
      data.experienceMax >= data.experienceMin,
    {
      message: "experienceMax must be greater than or equal to experienceMin",
      path: ["experienceMax"],
    },
  );

export const employerUpdateJobSchema = z
  .object({
    title: z.string().min(1, "Title is required").optional(),
    description: z.string().min(1, "Description is required").optional(),
    categoryId: z.string().uuid().nullable().optional(),
    professionId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    responsibilities: z.string().nullable().optional(),
    requirements: z.string().nullable().optional(),
    educationRequirements: z.string().nullable().optional(),
    benefits: z.string().nullable().optional(),
    experienceMin: z.number().int().min(0).nullable().optional(),
    experienceMax: z.number().int().min(0).nullable().optional(),
    employmentType: EmploymentType.nullable().optional(),
    salaryMin: z.number().min(0).nullable().optional(),
    salaryMax: z.number().min(0).nullable().optional(),
    salaryCurrency: z.string().nullable().optional(),
    salaryPeriod: SalaryPeriod.nullable().optional(),
    postedAt: z.string().datetime().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    applicationUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMax >= data.salaryMin,
    {
      message: "salaryMax must be greater than or equal to salaryMin",
      path: ["salaryMax"],
    },
  )
  .refine(
    (data) =>
      data.experienceMin == null ||
      data.experienceMax == null ||
      data.experienceMax >= data.experienceMin,
    {
      message: "experienceMax must be greater than or equal to experienceMin",
      path: ["experienceMax"],
    },
  );

export const employerJobStatusSchema = z
  .object({
    status: z.enum(["PENDING_REVIEW", "DRAFT"]),
  })
  .strict();

export type EmployerCreateJobInput = z.infer<typeof employerCreateJobSchema>;
export type EmployerUpdateJobInput = z.infer<typeof employerUpdateJobSchema>;
export type EmployerJobStatusInput = z.infer<typeof employerJobStatusSchema>;
