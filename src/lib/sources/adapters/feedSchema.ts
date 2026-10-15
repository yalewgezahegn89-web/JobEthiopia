import { z } from "zod";
import { httpUrlSchema } from "@/lib/validations/employerJob";

/**
 * Documented JSON feed contract used by the automated ingestion adapters.
 *
 * A compliant JSON feed is a top-level array of objects conforming to this
 * schema. Field names mirror the ingestion boundary types (`RawJobInput`),
 * so a validated item maps one-to-one onto the ingestion pipeline. Unknown
 * extra keys are ignored; optional fields may be null.
 *
 * Every source type is NOT covered here — only structured API/FEED sources
 * that expose this exact record shape are eligible for automated ingestion.
 */
export const jsonFeedItemSchema = z.object({
  title: z.string().min(1, "title is required").max(200),
  description: z.string().min(1, "description is required"),
  organizationName: z.string().min(1, "organizationName is required"),

  locationName: z.string().min(1).nullable().optional(),
  professionName: z.string().min(1).nullable().optional(),
  categoryName: z.string().min(1).nullable().optional(),
  employmentType: z.string().min(1).nullable().optional(),
  salaryRaw: z.string().min(1).nullable().optional(),
  experienceRaw: z.string().min(1).nullable().optional(),

  responsibilities: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  educationRequirements: z.string().nullable().optional(),
  benefits: z.string().nullable().optional(),

  postedAt: z
    .string()
    .datetime({ message: "postedAt must be a valid ISO 8601 datetime" })
    .nullable()
    .optional(),
  deadline: z
    .string()
    .datetime({ message: "deadline must be a valid ISO 8601 datetime" })
    .nullable()
    .optional(),

  applicationUrl: httpUrlSchema.nullable().optional(),
  externalId: z.string().nullable().optional(),
  sourceUrl: httpUrlSchema.nullable().optional(),
});

export type JsonFeedItem = z.infer<typeof jsonFeedItemSchema>;