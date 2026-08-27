import { z } from "zod";
import type { RawJobInput } from "../ingestion/types";

const rawJobInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  sourceId: z.string().min(1, "Source ID is required"),

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
    .datetime({
      message: "postedAt must be a valid ISO 8601 datetime",
    })
    .nullable()
    .optional(),

  deadline: z
    .string()
    .datetime({
      message: "deadline must be a valid ISO 8601 datetime",
    })
    .nullable()
    .optional(),

  applicationUrl: z
    .string()
    .url({
      message: "applicationUrl must be a valid URL",
    })
    .nullable()
    .optional(),

  externalId: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});

type ValidateResult =
  | { success: true; data: RawJobInput }
  | { success: false; error: string };

export function validateRawJobInput(input: unknown): ValidateResult {
  const result = rawJobInputSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data as RawJobInput };
  }

  const firstError = result.error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : "";
  return { success: false, error: `${path}${firstError.message}` };
}
