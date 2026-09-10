/**
 * Zod schemas for job-alert mutations (Phase 7 Batch 6).
 *
 * Filters are optional and AND together at match time. An absent filter means
 * "any". An explicitly nulled filter (update only) clears the saved value.
 */
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

const AlertFrequency = z.enum(["INSTANT", "DAILY"]);
const AlertLocale = z.enum(["en", "am", "om"]);
const AlertInternalStatus = z.enum(["ACTIVE", "PAUSED"]);

export const createJobAlertSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    keywords: z.string().trim().max(200, "Keywords are too long").optional(),
    categoryId: z.string().uuid().optional(),
    professionId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    employmentType: EmploymentType.optional(),
    frequency: AlertFrequency.optional().default("DAILY"),
    locale: AlertLocale.optional().default("en"),
  })
  .strict();

export const updateJobAlertSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    keywords: z.string().trim().max(200, "Keywords are too long").nullable(),
    categoryId: z.string().uuid().nullable(),
    professionId: z.string().uuid().nullable(),
    locationId: z.string().uuid().nullable(),
    employmentType: EmploymentType.nullable(),
    frequency: AlertFrequency,
    locale: AlertLocale,
    status: AlertInternalStatus,
  })
  .partial()
  .strict();

export const jobAlertIdParamSchema = z.object({
  alertId: z.string().uuid("alertId must be a valid UUID"),
});

export type CreateJobAlertInput = z.infer<typeof createJobAlertSchema>;
export type UpdateJobAlertInput = z.infer<typeof updateJobAlertSchema>;
export type JobAlertIdParam = z.infer<typeof jobAlertIdParamSchema>;