"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/login";
import { checkRateLimit } from "@/lib/rateLimit";
import { submitEmployerOnboarding } from "@/lib/employerOnboarding/dal";
import { employerOnboardingSchema } from "@/lib/employerOnboarding/schema";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";
import { EMPLOYER_ONBOARDING_ERROR_NEUTRAL } from "./types";
import type { EmployerOnboardingActionState } from "./types";

const ROUTE = "/employer/register";
const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_MS = 15 * 60_000;

export async function employerOnboardingAction(
  _previousState: EmployerOnboardingActionState,
  formData: FormData,
): Promise<EmployerOnboardingActionState> {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (
    status: number,
    errorCode: string,
  ): EmployerOnboardingActionState => {
    logWarn("employer_onboarding_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return { error: EMPLOYER_ONBOARDING_ERROR_NEUTRAL };
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
    organizationName: String(formData.get("organizationName") ?? ""),
    organizationSlug: String(formData.get("organizationSlug") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    description: String(formData.get("description") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
  };

  const parsed = employerOnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    logWarn("employer_onboarding_failed", {
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

  const emailLimit = checkRateLimit(`employer-onboarding:email:${email}`, {
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  });
  if (!emailLimit.allowed) {
    // Does not reveal whether an account/request exists; the same neutral
    // message is returned for rate-limited and duplicate attempts alike.
    return reject(429, "RATE_LIMITED");
  }

  let result;
  try {
    result = await submitEmployerOnboarding(parsed.data);
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

  logInfo("employer_onboarding_submitted", {
    requestId,
    route: ROUTE,
    method: "POST",
    status: 201,
    errorCode: "OK",
    durationMs: Math.round(performance.now() - start),
  });

  redirect("/employer/status");
}
