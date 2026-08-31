import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const organizationSlugSchema = z
  .string()
  .trim()
  .min(1, "Organization slug is required")
  .max(80, "Organization slug must be 80 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens",
  );

/**
 * Strict employer self-service onboarding request schema (Batch 97).
 *
 * Only the credential and organization fields below are accepted. `.strict()`
 * rejects every unknown property, so a client can never submit `userId`,
 * `role`, `organizationId`, `membershipId`, `isActive`, `isVerified`,
 * `status`, `reviewedBy`, `reviewedAt`, or any other privileged field — those
 * are always derived and enforced server-side.
 *
 * The request is deliberately scoped to "request only": submitting it creates
 * a CANDIDATE account plus a PENDING onboarding request. Role promotion to
 * ORGANIZATION_ADMIN and organization/membership creation happen later in a
 * separate, staff-only atomic approval step. Email is normalized elsewhere
 * using the canonical normalizeEmail(); this schema validates shape only.
 */
export const employerOnboardingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name must be 100 characters or fewer"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      ),
    confirmPassword: z.string().min(1, "Confirm your password"),
    organizationName: z
      .string()
      .trim()
      .min(1, "Organization name is required")
      .max(150, "Organization name must be 150 characters or fewer"),
    organizationSlug: organizationSlugSchema,
    industry: z
      .string()
      .trim()
      .max(100, "Industry must be 100 characters or fewer")
      .optional()
      .or(z.literal("")),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer")
      .optional()
      .or(z.literal("")),
    websiteUrl: z
      .string()
      .trim()
      .max(2000, "Website URL must be 2000 characters or fewer")
      .url("Enter a valid URL")
      .optional()
      .or(z.literal("")),
    contactPhone: z
      .string()
      .trim()
      .max(30, "Phone number must be 30 characters or fewer")
      .optional()
      .or(z.literal("")),
    locationId: z
      .string()
      .uuid("Select a valid location")
      .optional()
      .or(z.literal("")),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type EmployerOnboardingInput = z.infer<typeof employerOnboardingSchema>;
