import { z } from "zod";

/**
 * Normalizes a phone number.
 *
 * Strips spaces, dashes, and dots; allows an optional leading "+"; then
 * requires 7-15 numeric characters (after the optional plus). No country-code
 * rules are enforced: Ethiopian and international formats are both accepted.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(/[\s\-.]/g, "");
}

const phoneSchema = z
  .string()
  .transform((value) => normalizePhone(value) ?? value)
  .pipe(
    z
      .string()
      .regex(/^[+]?[0-9]{7,15}$/, "Enter a valid phone number"),
  );

function emptyToNull(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const candidateProfileSchema = z
  .object({
    phone: z.union([z.literal(""), phoneSchema, z.null()]).transform(emptyToNull),
    locationId: z
      .union([z.literal(""), z.string().uuid("Select a valid location"), z.null()])
      .transform(emptyToNull),
    professionalSummary: z
      .preprocess(
        (v) => (typeof v === "string" ? emptyToNull(v) : v),
        z
          .string()
          .max(1000, "Professional summary must be 1000 characters or fewer")
          .nullish(),
      ),
    totalExperienceYears: z
      .union([z.literal(""), z.number(), z.null()])
      .transform((v) => (v === "" ? null : v))
      .superRefine((value, ctx) => {
        if (value == null) return;
        if (!Number.isInteger(value)) {
          ctx.addIssue({ code: "custom", message: "Experience must be a whole number" });
        } else if (value < 0) {
          ctx.addIssue({ code: "custom", message: "Experience cannot be negative" });
        } else if (value > 60) {
          ctx.addIssue({ code: "custom", message: "Experience cannot exceed 60 years" });
        }
      }),
    education: z
      .preprocess(
        (v) => (typeof v === "string" ? emptyToNull(v) : v),
        z
          .string()
          .max(200, "Education must be 200 characters or fewer")
          .nullish(),
      ),
  })
  .strict();

export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
