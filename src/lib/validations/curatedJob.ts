/**
 * Validation schema for staff-curated job creation (Phase 6 Step 7).
 *
 * Extends the employer create-job contract with an optional "original source"
 * block used ONLY by the manual/curated admin flow. It lets staff record the
 * external publisher's stable site name, the official vacancy URL and the
 * employer's own vacancy reference so provenance can preserve BOTH:
 *   (a) the internal data-entry method (server-resolved Manual Entry edge), and
 *   (b) the original external vacancy source.
 *
 * The employer API contract (employerCreateJobSchema) is untouched: an
 * employer payload carrying originalSource is rejected by .strict() there.
 */
import { z } from "zod";
import { employerJobFields, httpUrlSchema } from "./employerJob";

export const curatedOriginalSourceSchema = z
  .object({
    sourceName: z
      .string()
      .trim()
      .min(1, "Original source name is required")
      .max(120, "Original source name must be 120 characters or fewer"),
    sourceUrl: httpUrlSchema,
    externalId: z
      .string()
      .trim()
      .min(1, "Original vacancy reference must be a non-empty string")
      .max(120, "Original vacancy reference must be 120 characters or fewer")
      .optional(),
  })
  .strict();

export const curatedCreateJobSchema = z
  .object({
    ...employerJobFields,
    originalSource: curatedOriginalSourceSchema.optional(),
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

export type CuratedOriginalSource = z.infer<typeof curatedOriginalSourceSchema>;
export type CuratedCreateJobInput = z.infer<typeof curatedCreateJobSchema>;