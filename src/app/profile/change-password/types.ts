import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/**
 * B96 — candidate password-change UI.
 *
 * Focussed schema + action state for changing the current user's password.
 * The actual mutation is delegated to the existing `changePassword()` in
 * `src/lib/auth/password.ts`; this module never duplicates hashing/verification
 * and never stores or logs a password value. Passwords are never trimmed,
 * normalized, or case-transformed.
 */
export interface ChangePasswordFieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface ChangePasswordActionState {
  fieldErrors?: ChangePasswordFieldErrors;
  formError?: string;
  success?: string;
}

/**
 * User-safe, backend-agnostic messages. No hash, user object, session token,
 * or backend detail is ever surfaced here.
 */
export const CHANGE_PASSWORD_ERROR_CSRF =
  "Unable to change password. Please try again.";
export const CHANGE_PASSWORD_ERROR_INVALID_CURRENT =
  "Your current password is incorrect.";
export const CHANGE_PASSWORD_ERROR_WEAK =
  "New password must be at least 8 characters.";
export const CHANGE_PASSWORD_ERROR_RATE_LIMITED =
  "Too many attempts. Please try again later.";
export const CHANGE_PASSWORD_ERROR_SERVER =
  "Something went wrong. Please try again.";
export const CHANGE_PASSWORD_ERROR_SAME_PASSWORD =
  "Your new password must be different from your current password.";
export const CHANGE_PASSWORD_SUCCESS = "Your password has been changed.";

/**
 * Strict schema. `.strict()` rejects any unknown field (role, userId,
 * isActive, passwordHash, confirm-as-bool, etc.) so a client can never smuggle
 * them in. Cross-field equality is enforced at the schema level.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, CHANGE_PASSWORD_ERROR_WEAK),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
