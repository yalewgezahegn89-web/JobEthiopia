"use server";

import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { checkRateLimit } from "@/lib/rateLimit";
import { resubmitEmployerOnboarding } from "@/lib/employerOnboarding/dal";
import { employerOnboardingResubmitSchema } from "@/lib/employerOnboarding/schema";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/employer/status";
const USER_LIMIT = 5;
const USER_WINDOW_MS = 15 * 60_000;

export type EmployerResubmitActionState = {
  fieldErrors?: Record<string, string>;
  errorCode?: string | null;
};

/**
 * Re-submits a previously REJECTED employer onboarding request using the
 * authenticated session holder's existing account (Phase 11).
 *
 * The actor is resolved from the verified session; the request row and its
 * eligibility are enforced in the DAL (only the latest REJECTED request may be
 * resubmitted). Client input can never promote a role, create a user, or set a
 * status — the existing account is reused unchanged.
 */
export async function resubmitEmployerOnboardingAction(
  _previousState: EmployerResubmitActionState,
  formData: FormData,
): Promise<EmployerResubmitActionState> {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (
    status: number,
    errorCode: string,
  ): EmployerResubmitActionState => {
    logWarn("employer_onboarding_resubmit_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return { errorCode };
  };

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "CSRF_REJECTED");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const rateLimit = checkRateLimit(`employer-onboarding:user:${user.id}`, {
    limit: USER_LIMIT,
    windowMs: USER_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return reject(429, "RATE_LIMITED");
  }

  const raw = {
    organizationName: String(formData.get("organizationName") ?? ""),
    organizationSlug: String(formData.get("organizationSlug") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    description: String(formData.get("description") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
  };

  const parsed = employerOnboardingResubmitSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    logWarn("employer_onboarding_resubmit_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 400,
      errorCode: "VALIDATION_FAILED",
      durationMs: Math.round(performance.now() - start),
    });
    return { fieldErrors };
  }

  let result;
  try {
    result = await resubmitEmployerOnboarding(user.id, parsed.data);
  } catch {
    logError("employer_onboarding_resubmit_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 500,
      errorCode: "INTERNAL_ERROR",
      durationMs: Math.round(performance.now() - start),
    });
    return { errorCode: "INTERNAL" };
  }

  if (!result.ok) {
    if (result.code === "duplicate") {
      return reject(409, "DUPLICATE");
    }
    if (result.code === "not_eligible") {
      return reject(409, "NOT_ELIGIBLE");
    }
    return reject(500, "INTERNAL_ERROR");
  }

  logInfo("employer_onboarding_resubmitted", {
    requestId,
    route: ROUTE,
    method: "POST",
    status: 201,
    errorCode: "OK",
    durationMs: Math.round(performance.now() - start),
  });

  redirect("/employer/status");
}