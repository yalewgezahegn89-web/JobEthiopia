/**
 * Shared types and constants for the phone-first authentication flow.
 *
 * This is a normal (non-server-action) module. It intentionally lives OUTSIDE
 * the "use server" boundary in actions.ts so that the server-action module
 * exports only the three async server actions, and so that client components
 * (phone-form.tsx) can import these types/constants without pulling in the
 * server-action module.
 */

export type PhoneActionState = {
  fieldErrors?: Record<string, string>;
  error?: string | null;
  ok?: boolean;
  requestId?: string | null;
  needsName?: boolean;
};

export const PHONE_ERROR_GENERIC =
  "We could not complete that request. Please try again.";
export const PHONE_ERROR_INVALID =
  "Enter a valid Ethiopian mobile number (e.g. 0912345678 or +251912345678).";
export const PHONE_ERROR_OTP =
  "The verification code is invalid or has expired. Please try again.";

export type PhoneStepResult = {
  ok: boolean;
  error?: string;
  requestId?: string;
  needsName?: boolean;
};
