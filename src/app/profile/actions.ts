"use server";

import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { updateCandidateProfile } from "@/lib/candidateProfile/dal";
import { candidateProfileSchema } from "@/lib/validations/candidateProfile";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export type ProfileActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  changes?: string[];
};

const GENERIC_ERROR = "Unable to save your profile. Please try again.";

export async function updateProfileAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const requestId = await getRequestId();
  const route = "/profile";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("candidate_profile_update_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const experienceRaw = String(formData.get("totalExperienceYears") ?? "").trim();
  const totalExperienceYears =
    experienceRaw.length === 0 ? null : Number(experienceRaw);

  const parsed = candidateProfileSchema.safeParse({
    phone: String(formData.get("phone") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    professionalSummary: String(formData.get("professionalSummary") ?? ""),
    totalExperienceYears: Number.isNaN(totalExperienceYears)
      ? ""
      : totalExperienceYears,
    education: String(formData.get("education") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    logWarn("candidate_profile_update_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "VALIDATION_FAILED",
    });
    return { ok: false, fieldErrors };
  }

  try {
    const result = await updateCandidateProfile(user.id, parsed.data);
    if (!result.ok) {
      logWarn("candidate_profile_update_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INVALID_INPUT",
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    logInfo("candidate_profile_updated", {
      requestId,
      route,
      method: "POST",
      errorCode: "OK",
    });

    return { ok: true, changes: result.changes };
  } catch {
    logWarn("candidate_profile_update_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}
