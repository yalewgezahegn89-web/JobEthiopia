"use server";

import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { cvSchema, type CvInput } from "@/lib/validations/cv";
import { saveCv, deleteCv, getOwnedCv } from "@/lib/cv/dal";
import { trackCvEvent } from "@/lib/analytics/cvEvents";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export type CvActionResult = {
  ok: boolean;
  error?: string;
  created?: boolean;
};

export type CvDeleteResult = {
  ok: boolean;
  error?: string;
};

const GENERIC_ERROR = "Unable to save your CV. Please try again.";

function onlyNonEmpty<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.filter((item) =>
    Object.values(item).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    ),
  );
}

async function requireCandidate() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");
  return user;
}

export async function saveCvAction(
  _prevState: CvActionResult,
  formData: FormData,
): Promise<CvActionResult> {
  const requestId = await getRequestId();
  const route = "/cv/edit";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cv_save_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const raw = String(formData.get("data") ?? "");
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    logWarn("cv_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INVALID_BODY",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  const object = (payload ?? {}) as Record<string, unknown>;

  const parsed = cvSchema.safeParse({
    header: (object.header ?? {}) as Record<string, unknown>,
    experiences: onlyNonEmpty(
      Array.isArray(object.experiences)
        ? (object.experiences as Record<string, unknown>[])
        : [],
    ),
    educations: onlyNonEmpty(
      Array.isArray(object.educations)
        ? (object.educations as Record<string, unknown>[])
        : [],
    ),
    skills: onlyNonEmpty(
      Array.isArray(object.skills)
        ? (object.skills as Record<string, unknown>[])
        : [],
    ),
    certifications: onlyNonEmpty(
      Array.isArray(object.certifications)
        ? (object.certifications as Record<string, unknown>[])
        : [],
    ),
  });

  if (!parsed.success) {
    logWarn("cv_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "VALIDATION_FAILED",
      issueCount: parsed.error.issues.length,
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await saveCv(user.id, parsed.data as CvInput);
    if (!result.ok) {
      logWarn("cv_save_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INVALID_INPUT",
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    await trackCvEvent({
      event: result.created ? "cv_created" : "cv_updated",
    });

    logInfo("cv_saved", {
      requestId,
      route,
      method: "POST",
      created: result.created,
      errorCode: "OK",
      experienceCount: result.cv.experiences.length,
      educationCount: result.cv.educations.length,
      skillCount: result.cv.skills.length,
      certificationCount: result.cv.certifications.length,
    });

    return { ok: true, created: result.created };
  } catch {
    logWarn("cv_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function deleteCvAction(): Promise<CvDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cv";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cv_delete_failed", {
        requestId,
        route,
        method: "DELETE",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await deleteCv(user.id);

    await trackCvEvent({ event: "cv_deleted" });

    logInfo("cv_deleted", {
      requestId,
      route,
      method: "DELETE",
      deleted: result.ok && result.deleted,
      errorCode: "OK",
    });

    return { ok: true };
  } catch {
    logWarn("cv_delete_failed", {
      requestId,
      route,
      method: "DELETE",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function recordCvPreviewAction(): Promise<CvDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cv/preview";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cv_preview_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const owned = await getOwnedCv(user.id);
    if (!owned) return { ok: false, error: "NOT_FOUND" };

    await trackCvEvent({ event: "cv_previewed" });

    logInfo("cv_previewed", {
      requestId,
      route,
      method: "POST",
      errorCode: "OK",
    });

    return { ok: true };
  } catch {
    logWarn("cv_preview_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function recordCvDownloadAction(): Promise<CvDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cv/preview";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cv_download_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const owned = await getOwnedCv(user.id);
    if (!owned) return { ok: false, error: "NOT_FOUND" };

    await trackCvEvent({ event: "cv_downloaded" });

    logInfo("cv_downloaded", {
      requestId,
      route,
      method: "POST",
      errorCode: "OK",
    });

    return { ok: true };
  } catch {
    logWarn("cv_download_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}