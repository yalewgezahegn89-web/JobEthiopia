import { z } from "zod";

/**
 * Phase 12 — Account settings action contract.
 *
 * Actions return stable result codes (never user-facing strings) so the client
 * forms can map them to localized messages via the Dictionary. Field errors
 * come from the zod schemas below and are surfaced as-is.
 */

export type SettingsErrorCode =
  | "rate_limited"
  | "invalid_current"
  | "same_email"
  | "error";

export type SettingsActionResult = {
  ok?: boolean;
  code?: SettingsErrorCode;
  fieldErrors?: Record<string, string>;
};

/**
 * Strict email-change schema. `.strict()` rejects unknown properties so a
 * client can never smuggle userId/role/emailVerifiedAt-style fields.
 * Passwords are never trimmed, normalized, or transformed here or downstream.
 */
export const changeEmailSchema = z
  .object({
    newEmail: z
      .string()
      .trim()
      .min(1, "New email is required")
      .email("Enter a valid email address"),
    currentPassword: z.string().min(1, "Your current password is required"),
  })
  .strict();