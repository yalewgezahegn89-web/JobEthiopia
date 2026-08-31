"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { hashSessionToken } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  changePasswordSchema,
  CHANGE_PASSWORD_ERROR_CSRF,
  CHANGE_PASSWORD_ERROR_INVALID_CURRENT,
  CHANGE_PASSWORD_ERROR_RATE_LIMITED,
  CHANGE_PASSWORD_ERROR_SAME_PASSWORD,
  CHANGE_PASSWORD_ERROR_SERVER,
  CHANGE_PASSWORD_ERROR_WEAK,
  CHANGE_PASSWORD_SUCCESS,
} from "./types";
import type {
  ChangePasswordActionState,
  ChangePasswordFieldErrors,
} from "./types";

/**
 * Server action for the candidate password-change UI.
 *
 * This is a thin, UI-facing wrapper around the existing `changePassword()`
 * mutation. It performs authentication, CSRF, schema validation, and error
 * mapping only — it never hashes or verifies a password itself and never
 * stores or logs a password value. Password mutation is delegated entirely to
 * `changePassword()`.
 *
 * Session semantics are inherited from the backend: the current session stays
 * valid and every other session for the user is revoked. On success the user is
 * intentionally left on /profile (no redirect, no logout).
 */
const USER_LIMIT = 5;
const USER_WINDOW_MS = 15 * 60_000;

export async function changePasswordAction(
  _previousState: ChangePasswordActionState,
  formData: FormData,
): Promise<ChangePasswordActionState> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { formError: CHANGE_PASSWORD_ERROR_CSRF };
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE") redirect("/jobs");

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

  // Optional UX guard (action-level only). The authoritative logic in
  // password.ts does not enforce reuse; server-side enforcement is deferred to
  // Batch 98 per the roadmap.
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return { formError: CHANGE_PASSWORD_ERROR_SAME_PASSWORD };
  }

  // Per-user wrong-attempt bound. Uses the existing checkRateLimit() with an
  // inline user-scoped key; no rate-limit bucket infrastructure is changed.
  const userLimit = checkRateLimit(`password:user:${user.id}`, {
    limit: USER_LIMIT,
    windowMs: USER_WINDOW_MS,
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

  return { success: CHANGE_PASSWORD_SUCCESS };
}

/**
 * Resolves the current session's DB id from the session cookie, mirroring the
 * existing `/api/user/password` route so the current session can be preserved
 * while every other session is revoked by changePassword().
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
