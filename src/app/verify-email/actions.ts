"use server";

import { cookies } from "next/headers";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { hashSessionToken } from "@/lib/auth/session";
import { verifyEmailToken } from "@/lib/auth/emailVerification";
import { verifyEmailChange } from "@/lib/auth/emailChange";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export type VerifyEmailActionState = {
  success?: boolean;
};

const ROUTE = "/verify-email";

/**
 * Resolves the current session id (if any) so email verification can preserve
 * the acting session while other sessions are revoked. Best-effort.
 */
async function resolveCurrentSessionIdOrNull(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
    if (!rawToken) return undefined;
    const tokenHash = hashSessionToken(rawToken);

    const { db } = await import("@/db");
    const { sessions } = await import("@/db/schema/sessions");
    const { eq } = await import("drizzle-orm");

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.tokenHash, tokenHash),
      columns: { id: true },
    });
    return session?.id;
  } catch {
    return undefined;
  }
}

/**
 * Consumes an email verification link. `type=change` routes to the email-change
 * verifier (activates the pending new email); all other links run the initial
 * verification path. The raw token arrives only via the hidden form fields on
 * the /verify-email page, never through logs.
 */
export async function verifyEmailLinkAction(
  _previousState: VerifyEmailActionState,
  formData: FormData,
): Promise<VerifyEmailActionState> {
  const requestId = await getRequestId();
  const token = String(formData.get("token") ?? "");
  const type = String(formData.get("type") ?? "verify");

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { success: false };
  }
  if (!token) {
    return { success: false };
  }

  if (type === "change") {
    const result = await verifyEmailChange(token, {
      currentSessionId: await resolveCurrentSessionIdOrNull(),
    });
    if (!result.ok) {
      logWarn("email_change_verification_failed", {
        requestId,
        route: ROUTE,
        method: "POST",
        errorCode: result.reason,
      });
      return { success: false };
    }
    logInfo("email_change_verified", {
      requestId,
      route: ROUTE,
      method: "POST",
      errorCode: "OK",
    });
    return { success: true };
  }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    logWarn("email_verification_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      errorCode: result.reason,
    });
    return { success: false };
  }
  logInfo("email_verified", {
    requestId,
    route: ROUTE,
    method: "POST",
    errorCode: "OK",
  });
  return { success: true };
}