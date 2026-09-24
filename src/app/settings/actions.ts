"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  hashSessionToken,
  revokeSessionById,
  revokeSessionsForUser,
} from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/password";
import {
  buildEmailVerificationUrl,
  requestEmailVerification,
} from "@/lib/auth/emailVerification";
import { requestEmailChange } from "@/lib/auth/emailChange";
import {
  dispatchEmailVerification,
  dispatchEmailChangeVerification,
} from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { notifyAccountSecurity } from "@/lib/notifications/events";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";
import { changeEmailSchema, type SettingsActionResult } from "./types";
import {
  changePasswordSchema,
  CHANGE_PASSWORD_ERROR_CSRF,
  CHANGE_PASSWORD_ERROR_INVALID_CURRENT,
  CHANGE_PASSWORD_ERROR_RATE_LIMITED,
  CHANGE_PASSWORD_ERROR_SAME_PASSWORD,
  CHANGE_PASSWORD_ERROR_SERVER,
  CHANGE_PASSWORD_ERROR_WEAK,
  CHANGE_PASSWORD_SUCCESS,
  type ChangePasswordActionState,
  type ChangePasswordFieldErrors,
} from "../profile/change-password/types";

const ROUTE = "/settings";
const PASSWORD_USER_LIMIT = 5;
const PASSWORD_WINDOW_MS = 15 * 60_000;

/**
 * Role-agnostic gate for the account settings surface. Any authenticated user
 * (candidate, employer, staff) manages the same account security primitives.
 */
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the current session's DB id from the session cookie so password
 * changes and "sign out other devices" can preserve the acting session while
 * revoking every other one.
 */
async function resolveCurrentSessionId(): Promise<string> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  const tokenHash = hashSessionToken(rawToken);

  const { db } = await import("@/db");
  const { sessions } = await import("@/db/schema/sessions");
  const { eq } = await import("drizzle-orm");

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, tokenHash),
    columns: { id: true },
  });

  if (!session) {
    throw new Error("Unable to resolve the current session");
  }
  return session.id;
}

/**
 * Resends the initial email verification link. Best-effort dispatch; the
 * underlying requestEmailVerification() is rate-limited (3/hour) and audits
 * EMAIL_VERIFICATION_REQUESTED. Never reveals whether an email exists.
 */
export async function resendEmailVerificationAction(): Promise<SettingsActionResult> {
  const requestId = await getRequestId();

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { code: "error" };
  }

  try {
    const user = await requireUser();
    const result = await requestEmailVerification(user.id);
    if (!result.ok) {
      logWarn("email_verification_resend_failed", {
        requestId,
        route: ROUTE,
        method: "POST",
        errorCode: result.reason,
      });
      return { ok: false, code: result.reason === "rate_limited" ? "rate_limited" : "error" };
    }

    if (result.rawToken && result.email) {
      await dispatchEmailVerification(
        result.email,
        buildEmailVerificationUrl(result.rawToken, "verify"),
      );
    }
    return { ok: true };
  } catch {
    return { code: "error" };
  }
}

/**
 * Starts the pending-email change workflow. Uses the existing requestEmailChange()
 * service (re-authentication by password, one pending token, rate-limited).
 * The new email is NOT activated until the emailed link is consumed.
 */
export async function changeEmailAction(
  _previousState: SettingsActionResult,
  formData: FormData,
): Promise<SettingsActionResult> {
  const requestId = await getRequestId();

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { code: "error" };
  }

  const user = await requireUser();

  const raw = {
    newEmail: String(formData.get("newEmail") ?? ""),
    currentPassword: String(formData.get("currentPassword") ?? ""),
  };
  const parsed = changeEmailSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const result = await requestEmailChange(
    user.id,
    parsed.data.newEmail,
    parsed.data.currentPassword,
  );
  if (!result.ok) {
    logWarn("email_change_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      errorCode: result.reason,
    });
    if (result.reason === "invalid_current") return { ok: false, code: "invalid_current" };
    if (result.reason === "same_email") return { ok: false, code: "same_email" };
    if (result.reason === "rate_limited") return { ok: false, code: "rate_limited" };
    return { ok: false, code: "error" };
  }

  if (result.rawToken) {
    await dispatchEmailChangeVerification(
      parsed.data.newEmail,
      buildEmailVerificationUrl(result.rawToken, "change"),
    );
  }
  await notifyAccountSecurity(user.id, "email_change_requested");

  logInfo("email_change_requested", {
    requestId,
    route: ROUTE,
    method: "POST",
    errorCode: "OK",
  });

  return { ok: true };
}

/**
 * Changes the current user's password while preserving their active session.
 * Delegates all credential logic to the shared changePassword() service.
 * Role-agnostic (unlike the candidate-only /profile variant).
 */
export async function changeSettingsPasswordAction(
  _previousState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { formError: CHANGE_PASSWORD_ERROR_CSRF };
  }

  const user = await requireUser();

  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: ChangePasswordFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (
        (key === "currentPassword" ||
          key === "newPassword" ||
          key === "confirmPassword") &&
        !fieldErrors[key]
      ) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return { formError: CHANGE_PASSWORD_ERROR_SAME_PASSWORD };
  }

  const userLimit = checkRateLimit(`password:user:${user.id}`, {
    limit: PASSWORD_USER_LIMIT,
    windowMs: PASSWORD_WINDOW_MS,
  });
  if (!userLimit.allowed) {
    return { formError: CHANGE_PASSWORD_ERROR_RATE_LIMITED };
  }

  let currentSessionId: string;
  let result;
  try {
    currentSessionId = await resolveCurrentSessionId();
    result = await changePassword(
      user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      currentSessionId,
    );
  } catch {
    return { formError: CHANGE_PASSWORD_ERROR_SERVER };
  }

  if (!result.ok) {
    if (result.reason === "invalid_current") {
      return { formError: CHANGE_PASSWORD_ERROR_INVALID_CURRENT };
    }
    if (result.reason === "weak_new") {
      return { formError: CHANGE_PASSWORD_ERROR_WEAK };
    }
    return { formError: CHANGE_PASSWORD_ERROR_SERVER };
  }

  await notifyAccountSecurity(user.id, "password_changed");
  return { success: CHANGE_PASSWORD_SUCCESS };
}

/**
 * Revokes a single session owned by the current user. Ownership is enforced
 * inside revokeSessionById() so cross-user revocation is impossible.
 */
export async function revokeSessionAction(
  _previousState: SettingsActionResult,
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { code: "error" };
  }

  try {
    const user = await requireUser();
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    if (!sessionId) return { ok: false, code: "error" };

    const revoked = await revokeSessionById(sessionId, user.id);
    if (!revoked) return { ok: false, code: "error" };

    await notifyAccountSecurity(user.id, "session_revoked");
    return { ok: true };
  } catch {
    return { code: "error" };
  }
}

/**
 * Ends every session except the acting session (e.g. after a password change
 * on another device, or a suspicious device is spotted).
 */
export async function revokeOtherSessionsAction(): Promise<SettingsActionResult> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { code: "error" };
  }

  try {
    const user = await requireUser();
    const currentSessionId = await resolveCurrentSessionId();

    const count = await revokeSessionsForUser(user.id, currentSessionId);
    await notifyAccountSecurity(user.id, "other_sessions_revoked", { count });
    return { ok: true };
  } catch {
    return { code: "error" };
  }
}