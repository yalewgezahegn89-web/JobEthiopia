"use server";

import { cookies } from "next/headers";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { requestOtp } from "@/lib/auth/phone-verification";
import {
  resolvePhoneUser,
  signInWithVerifiedPhone,
  createPhoneAccount as createPhoneAccountService,
} from "@/lib/auth/phoneAuth";
import {
  PHONE_ERROR_GENERIC,
  PHONE_ERROR_INVALID,
  PHONE_ERROR_OTP,
  type PhoneStepResult,
} from "./phone-action-types";
import { devOtpRequestOptions } from "./phone-otp-delivery";

/**
 * STEP 1 — request a verification code for a phone number.
 *
 * The OTP delivery callback is deliberately abstract in this stage (no SMS
 * provider). requestOtp persists the code hash and returns a requestId used for
 * the subsequent verification step. No code is ever returned to the client.
 *
 * In DEVELOPMENT/STAGING ONLY, and ONLY when NODE_ENV !== "production" AND
 * PHONE_OTP_DEV_DELIVERY=log is set, the dev delivery callback attached below
 * prints the code to the server log so the browser flow can be verified. In
 * production the callback is undefined and no code is ever logged.
 */
export async function requestPhoneOtp(
  rawPhone: string,
): Promise<PhoneStepResult> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { ok: false, error: PHONE_ERROR_GENERIC };
  }

  const result = await requestOtp(rawPhone, devOtpRequestOptions()).catch(() => ({
    ok: false as const,
    reason: "error" as const,
  }));

  if (!result.ok) {
    if (result.reason === "invalid_phone")
      return { ok: false, error: PHONE_ERROR_INVALID };
    if (result.reason === "resend_too_soon")
      return {
        ok: false,
        error: "Please wait a moment before requesting another code.",
      };
    if (result.reason === "rate_limited")
      return {
        ok: false,
        error: "Too many code requests. Please try again later.",
      };
    return { ok: false, error: PHONE_ERROR_GENERIC };
  }

  return { ok: true, requestId: result.requestId };
}

/**
 * STEP 2 — submit the verification code. Determines whether the phone maps to
 * an existing account (sign-in) or requires account creation (needsName).
 *
 * The OTP itself is only consumed atomically at the final sign-in / creation
 * step, so from here the client either proceeds to sign-in or is asked for a
 * name before creating the account.
 */
export async function submitPhoneCode(
  requestId: string,
  code: string,
  rawPhone: string,
): Promise<PhoneStepResult> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { ok: false, error: PHONE_ERROR_GENERIC };
  }

  if (!requestId || !code) {
    return { ok: false, error: PHONE_ERROR_OTP };
  }

  // Determine new vs existing phone identity WITHOUT consuming the OTP; the
  // final sign-in / creation step verifies and consumes it atomically.
  const resolved = await resolvePhoneUser(rawPhone).catch(() => ({
    ok: false as const,
    reason: "error" as const,
  }));

  if (resolved.ok) {
    const outcome = await signInWithVerifiedPhone(requestId, code, rawPhone).catch(
      () => null,
    );
    if (!outcome || !outcome.ok) {
      return { ok: false, error: PHONE_ERROR_OTP };
    }
    await setSessionCookie(outcome.rawToken);
    return { ok: true, needsName: false };
  }

  // No existing account -> new candidate path; ask for a name before creating.
  return { ok: true, requestId, needsName: true };
}

/**
 * STEP 3 — create a phone-first candidate account after name entry.
 * Verifies the OTP atomically, creates the candidate (email/passwordHash null,
 * role CANDIDATE, isActive true), links the phone, and creates the session.
 */
export async function createPhoneAccount(
  requestId: string,
  code: string,
  rawPhone: string,
  name: string,
): Promise<PhoneStepResult> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { ok: false, error: PHONE_ERROR_GENERIC };
  }

  if (!requestId || !code) {
    return { ok: false, error: PHONE_ERROR_OTP };
  }
  if (!name.trim()) {
    return { ok: false, error: "Please enter your full name." };
  }

  const outcome = await createPhoneAccountService(
    requestId,
    code,
    rawPhone,
    name,
  ).catch(() => null);
  if (!outcome || !outcome.ok) {
    return { ok: false, error: PHONE_ERROR_OTP };
  }

  await setSessionCookie(outcome.rawToken);
  return { ok: true, needsName: false };
}

async function setSessionCookie(rawToken: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}
