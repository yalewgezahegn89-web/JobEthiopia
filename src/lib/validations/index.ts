import { z } from "zod";

const OrganizationStatus = z.enum(["ACTIVE", "INACTIVE"]);
const LocationType = z.enum(["COUNTRY", "REGION", "CITY", "DISTRICT", "OTHER"]);
const SourceType = z.enum(["MANUAL", "WEBSITE", "API", "FEED", "EMPLOYER", "OTHER"]);
const TrustLevel = z.enum(["HIGH", "MEDIUM", "LOW"]);
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
const JobStatus = z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "EXPIRED", "REMOVED"]);
const VerificationStatus = z.enum(["PENDING", "VERIFIED", "NEEDS_REVIEW", "INVALID"]);
const ArticleStatus = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  type: LocationType,
  parentId: z.string().uuid().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateLocationSchema = createLocationSchema.partial();

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  isVerified: z.boolean().optional().default(false),
  status: OrganizationStatus.optional().default("ACTIVE"),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

export const createProfessionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const createSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sourceType: SourceType,
  baseUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  trustLevel: TrustLevel.optional().default("MEDIUM"),
});

export const updateSourceSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    sourceType: SourceType,
    baseUrl: z.string().url().nullable(),
    isActive: z.boolean(),
    trustLevel: TrustLevel,
  })
  .partial();

export const createJobSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
    categoryId: z.string().uuid().nullable().optional(),
    professionId: z.string().uuid().nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    description: z.string().min(1, "Description is required"),
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
      data.salaryMin == null || data.salaryMax == null || data.salaryMax >= data.salaryMin,
    { message: "salaryMax must be greater than or equal to salaryMin", path: ["salaryMax"] },
  )
  .refine(
    (data) =>
      data.experienceMin == null || data.experienceMax == null || data.experienceMax >= data.experienceMin,
    { message: "experienceMax must be greater than or equal to experienceMin", path: ["experienceMax"] },
  );

export const createCareerArticleSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens"),
    excerpt: z.string().nullable().optional(),
    content: z.string().min(1, "Content is required"),
    category: z.string().nullable().optional(),
    status: ArticleStatus.optional().default("DRAFT"),
  })
  .strict();

export const createJobSourceSchema = z.object({
  jobId: z.string().uuid("Job ID must be a valid UUID"),
  sourceId: z.string().uuid("Source ID must be a valid UUID"),
  sourceUrl: z.string().url("Source URL must be a valid URL"),
  externalId: z.string().nullable().optional(),
  rawHash: z.string().nullable().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export const updateOrganizationSchema = createOrganizationSchema.partial();

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProfessionInput = z.infer<typeof createProfessionSchema>;
export const updateProfessionSchema = createProfessionSchema.partial();
export type UpdateProfessionInput = z.infer<typeof updateProfessionSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;

export const updateJobSchema = z
  .object({
    status: JobStatus,
  })
  .partial()
  .strict();

export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateJobSourceInput = z.infer<typeof createJobSourceSchema>;
export const updateCareerArticleSchema = createCareerArticleSchema.partial();

export type CreateCareerArticleInput = z.infer<typeof createCareerArticleSchema>;
export type UpdateCareerArticleInput = z.infer<typeof updateCareerArticleSchema>;

export const createApplicationSchema = z
  .object({
    jobId: z.string().uuid("Job ID must be a valid UUID"),
    coverLetter: z.string().trim().max(2000).optional(),
  })
  .strict();

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const applicationIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});
export type ApplicationIdParam = z.infer<typeof applicationIdParamSchema>;

export { createSavedJobSchema, savedJobIdParamSchema } from "./savedJobs";
export type { CreateSavedJobInput, SavedJobIdParam } from "./savedJobs";
export { bulkApplicationStatusChangeSchema, BULK_STATUS_CHANGE_MAX_IDS } from "./applicationStatus";
export type { BulkApplicationStatusChangeInput } from "./applicationStatus";
