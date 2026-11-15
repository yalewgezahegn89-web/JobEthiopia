import { z } from "zod";

/**
 * The only fields staff may correct on a DRAFT job. Lifecycle status,
 * verification status, provenance, organization, location, category, and all
 * other fields are intentionally absent: the correction workflow must never be
 * able to publish, verify, or reclassify a job.
 */
export const draftJobCorrectionSchema = z
  .object({
    deadline: z
      .date()
      .refine((value) => !Number.isNaN(value.getTime()), {
        message: "A valid deadline is required",
      })
      .refine((value) => value.getTime() > Date.now(), {
        message: "Deadline must be in the future",
      }),
    description: z
      .string()
      .trim()
      .min(50, "Description must be at least 50 characters")
      .max(50000, "Description must be 50000 characters or fewer"),
    requirements: z
      .string()
      .trim()
      .max(20000, "Requirements must be 20000 characters or fewer")
      .nullable(),
  })
  .strict();

export type DraftJobCorrectionInput = z.infer<typeof draftJobCorrectionSchema>;
