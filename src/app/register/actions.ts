"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/login";
import { checkRateLimit } from "@/lib/rateLimit";
import { registerCandidate } from "@/lib/register/dal";
import { registerSchema } from "@/lib/register/schema";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";
import { REGISTER_ERROR_NEUTRAL } from "./types";
import type { RegisterActionState } from "./types";

const ROUTE = "/register";
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 15 * 60_000;

export async function registerAction(
  _previousState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (
    status: number,
    errorCode: string,
  ): RegisterActionState => {
    logWarn("candidate_registration_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return { error: REGISTER_ERROR_NEUTRAL };
  };

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "CSRF_REJECTED");
  }

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    logWarn("candidate_registration_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 400,
      errorCode: "VALIDATION_FAILED",
      durationMs: Math.round(performance.now() - start),
    });
    return { fieldErrors };
  }

  const email = normalizeEmail(parsed.data.email);

  const emailLimit = checkRateLimit(`register:email:${email}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailLimit.allowed) {
    // Does not reveal whether an account exists; the same neutral message is
    // returned for rate-limited and duplicate attempts alike.
    return reject(429, "RATE_LIMITED");
  }

  let result;
  try {
    result = await registerCandidate(parsed.data);
  } catch {
    return reject(500, "INTERNAL_ERROR");
  }
  if (!result.ok) {
    return reject(result.code === "duplicate" ? 409 : 500, result.code);
  }

  let rawToken: string;
  try {
    rawToken = await createSession(result.userId);
  } catch {
    return reject(500, "SESSION_CREATION_FAILED");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  logInfo("candidate_registration_succeeded", {
    requestId,
    route: ROUTE,
    method: "POST",
    status: 201,
    errorCode: "OK",
    durationMs: Math.round(performance.now() - start),
  });

  redirect("/jobs");
}
