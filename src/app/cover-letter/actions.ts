"use server";

import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest, CsrfError } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import {
  coverLetterSchema,
  parseCoverLetterReference,
  isValidUuid,
  type CoverLetterInput,
} from "@/lib/validations/coverLetter";
import {
  saveCoverLetter,
  deleteCoverLetter,
  duplicateCoverLetter,
  listCoverLetters,
} from "@/lib/coverLetter/dal";
import { trackCoverLetterEvent } from "@/lib/analytics/coverLetterEvents";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export type CoverLetterActionResult = {
  ok: boolean;
  error?: string;
  created?: boolean;
};

export type CoverLetterDeleteResult = {
  ok: boolean;
  error?: string;
};

const GENERIC_ERROR = "Unable to save your cover letter. Please try again.";

async function requireCandidate() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) redirect("/jobs");
  return user;
}

export async function saveCoverLetterAction(
  _prevState: CoverLetterActionResult,
  formData: FormData,
): Promise<CoverLetterActionResult> {
  const requestId = await getRequestId();
  const route = "/cover-letter";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cover_letter_save_failed", {
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
    logWarn("cover_letter_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INVALID_BODY",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  const object = (payload ?? {}) as Record<string, unknown>;

  const reference = parseCoverLetterReference(object);
  if (!reference.ok) {
    logWarn("cover_letter_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INVALID_REFERENCE",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = coverLetterSchema.safeParse({
    title: object.title,
    position: object.position,
    employer: object.employer,
    recipient: object.recipient,
    location: object.location,
    body: object.body,
  });

  if (!parsed.success) {
    logWarn("cover_letter_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "VALIDATION_FAILED",
      issueCount: parsed.error.issues.length,
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  let createdRowId: string | null = null;
  try {
    const result = await saveCoverLetter(
      user.id,
      parsed.data as CoverLetterInput,
      { existingId: reference.id, jobId: reference.jobId },
    );
    if (!result.ok) {
      logWarn("cover_letter_save_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: result.code,
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    await trackCoverLetterEvent({
      event: result.created ? "cover_letter_created" : "cover_letter_updated",
    });

    logInfo("cover_letter_saved", {
      requestId,
      route,
      method: "POST",
      created: result.created,
      errorCode: "OK",
    });

    createdRowId = result.row.id;
  } catch {
    logWarn("cover_letter_save_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect(`/cover-letter/${createdRowId}`);
}

export async function deleteCoverLetterAction(
  _prevState: CoverLetterDeleteResult,
  formData: FormData,
): Promise<CoverLetterDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cover-letter";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cover_letter_delete_failed", {
        requestId,
        route,
        method: "DELETE",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const id = String(formData.get("id") ?? "");
  if (!isValidUuid(id)) {
    logWarn("cover_letter_delete_failed", {
      requestId,
      route,
      method: "DELETE",
      errorCode: "INVALID_ID",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const result = await deleteCoverLetter(user.id, id);

    await trackCoverLetterEvent({ event: "cover_letter_deleted" });

    logInfo("cover_letter_deleted", {
      requestId,
      route,
      method: "DELETE",
      deleted: result.ok && result.deleted,
      errorCode: "OK",
    });

    return { ok: true };
  } catch {
    logWarn("cover_letter_delete_failed", {
      requestId,
      route,
      method: "DELETE",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function duplicateCoverLetterAction(
  _prevState: CoverLetterDeleteResult,
  formData: FormData,
): Promise<CoverLetterDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cover-letter";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cover_letter_duplicate_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const id = String(formData.get("id") ?? "");
  if (!isValidUuid(id)) {
    logWarn("cover_letter_duplicate_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INVALID_ID",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  let newId: string | null = null;
  try {
    const result = await duplicateCoverLetter(user.id, id);
    if (!result.ok) {
      logWarn("cover_letter_duplicate_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: result.code,
      });
      return { ok: false, error: GENERIC_ERROR };
    }

    await trackCoverLetterEvent({ event: "cover_letter_duplicated" });
    newId = result.row.id;
  } catch {
    logWarn("cover_letter_duplicate_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  redirect(`/cover-letter/${newId}`);
}

export async function recordCoverLetterPreviewAction(): Promise<CoverLetterDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cover-letter";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cover_letter_preview_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const letters = await listCoverLetters(user.id);
    if (letters.length === 0) return { ok: false, error: "NOT_FOUND" };

    await trackCoverLetterEvent({ event: "cover_letter_previewed" });

    return { ok: true };
  } catch {
    logWarn("cover_letter_preview_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function recordCoverLetterDownloadAction(): Promise<CoverLetterDeleteResult> {
  const requestId = await getRequestId();
  const route = "/cover-letter";

  const user = await requireCandidate();

  try {
    await assertTrustedCsrfFromRequest();
  } catch (err) {
    if (!(err instanceof CsrfError)) {
      logWarn("cover_letter_download_failed", {
        requestId,
        route,
        method: "POST",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const letters = await listCoverLetters(user.id);
    if (letters.length === 0) return { ok: false, error: "NOT_FOUND" };

    await trackCoverLetterEvent({ event: "cover_letter_downloaded" });

    return { ok: true };
  } catch {
    logWarn("cover_letter_download_failed", {
      requestId,
      route,
      method: "POST",
      errorCode: "INTERNAL_ERROR",
    });
    return { ok: false, error: GENERIC_ERROR };
  }
}