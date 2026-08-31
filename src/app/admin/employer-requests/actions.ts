"use server";

import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { approveEmployerOnboarding, rejectEmployerOnboarding, isValidUuid } from "@/lib/admin/employerRequests";

export type EmployerRequestActionResult = {
  ok: boolean;
  error?: string;
};

const GENERIC_ERROR = "Unable to update this request. Please try again.";

const APPROVE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export async function approveEmployerOnboardingAction(
  _prevState: EmployerRequestActionResult,
  formData: FormData,
): Promise<EmployerRequestActionResult> {
  const requestId = String(formData.get("requestId") ?? "");

  if (!isValidUuid(requestId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/employer-requests");
  }
  const actor = guard.user;

  if (!(APPROVE_ROLES as readonly string[]).includes(actor.role)) {
    return {
      ok: false,
      error: "You do not have permission to approve employer requests.",
    };
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await approveEmployerOnboarding(actor.id, requestId);
    if (!result.ok) {
      if (result.code === "INVALID_STATE") {
        return {
          ok: false,
          error: "This request is no longer pending or its account is not eligible for approval.",
        };
      }
      if (result.code === "NOT_FOUND") {
        return { ok: false, error: "This request could not be found." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}

export async function rejectEmployerOnboardingAction(
  _prevState: EmployerRequestActionResult,
  formData: FormData,
): Promise<EmployerRequestActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const reviewNotes = String(formData.get("reviewNotes") ?? "");

  if (!isValidUuid(requestId)) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin/employer-requests");
  }
  const actor = guard.user;

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (err instanceof CsrfError) {
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await rejectEmployerOnboarding(actor.id, requestId, reviewNotes);
    if (!result.ok) {
      if (result.code === "INVALID_STATE") {
        return {
          ok: false,
          error: "This request is no longer pending.",
        };
      }
      if (result.code === "NOT_FOUND") {
        return { ok: false, error: "This request could not be found." };
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
