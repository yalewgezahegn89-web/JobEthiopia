/**
 * Resume service layer (Batch 89).
 *
 * Orchestrates authorization, validation, private object storage, and the
 * database transaction. No database transaction is ever held open across a
 * network storage call, and storage cleanups are best-effort (never thrown to
 * the caller). Identity is always the server-resolved session user id.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import {
  getOwnedCandidateResume,
  getEmployerApplicationResume,
  upsertApplicationResume,
  deleteApplicationResume as dalDeleteApplicationResume,
  type ResumeMetadata,
  type ResumeRecord,
} from "./dal";
import {
  validateResumeFile,
  isPdfMagicBytes,
  MAX_RESUME_BYTES,
  RESUME_MIME,
  ResumeValidationError,
} from "./validation";
import * as storage from "./storage";
import { ResumeStorageError } from "./storage";
import { logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

export type UploadResumeResult =
  | { ok: true; resume: ResumeMetadata; created: boolean }
  | { ok: false; code: "APPLICATION_NOT_FOUND" };

export type DeleteResumeResult =
  | { ok: true; deleted: boolean }
  | { ok: false; code: "APPLICATION_NOT_FOUND" };

export type ResumeDownload = {
  resume: ResumeRecord;
  body: NodeJS.ReadableStream;
  contentType: string;
  contentLength: number | undefined;
};

export type DownloadResumeResult =
  | { ok: true; download: ResumeDownload }
  | { ok: false; code: "NOT_FOUND" };

function requireStorageConfigured(): void {
  if (!storage.isResumeStorageConfigured()) {
    throw new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED");
  }
}

async function requireOwnedApplication(
  applicationId: string,
  candidateUserId: string,
): Promise<boolean> {
  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateUserId, candidateUserId),
    ),
    columns: { id: true },
  });
  return !!app;
}

async function toSafeMetadata(record: ResumeRecord): Promise<ResumeMetadata> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { objectKey, ...safe } = record;
  return safe;
}

/**
 * Validates + uploads (new) or replaces (existing) the candidate's resume for a
 * specific owned application.
 */
async function uploadOrReplace(
  applicationId: string,
  candidateUserId: string,
  file: File,
): Promise<UploadResumeResult> {
  const owned = await requireOwnedApplication(applicationId, candidateUserId);
  if (!owned) return { ok: false, code: "APPLICATION_NOT_FOUND" };

  requireStorageConfigured();

  const originalName = validateResumeFile(file);

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength > MAX_RESUME_BYTES) {
    throw new ResumeValidationError("TOO_LARGE");
  }
  if (!isPdfMagicBytes(buffer)) {
    throw new ResumeValidationError("INVALID_SIGNATURE");
  }

  const objectKey = `resumes/${randomUUID()}.pdf`;
  await storage.putResumeObject(objectKey, buffer, RESUME_MIME);

  let result;
  try {
    result = await upsertApplicationResume({
      applicationId,
      candidateUserId,
      objectKey,
      originalName,
      mimeType: RESUME_MIME,
      size: buffer.byteLength,
    });
  } catch (err) {
    await safeDeleteResumeObject(objectKey);
    throw err;
  }

  if (!result.ok) {
    await safeDeleteResumeObject(objectKey);
    return { ok: false, code: "APPLICATION_NOT_FOUND" };
  }

  if (result.isReplacement && result.previousObjectKey) {
    await safeDeleteResumeObject(result.previousObjectKey);
  }

  return {
    ok: true,
    resume: await toSafeMetadata(result.record),
    created: !result.isReplacement,
  };
}

export function uploadApplicationResume(
  applicationId: string,
  candidateUserId: string,
  file: File,
): Promise<UploadResumeResult> {
  return uploadOrReplace(applicationId, candidateUserId, file);
}

export function replaceApplicationResume(
  applicationId: string,
  candidateUserId: string,
  file: File,
): Promise<UploadResumeResult> {
  return uploadOrReplace(applicationId, candidateUserId, file);
}

export async function deleteApplicationResume(
  applicationId: string,
  candidateUserId: string,
): Promise<DeleteResumeResult> {
  const owned = await requireOwnedApplication(applicationId, candidateUserId);
  if (!owned) return { ok: false, code: "APPLICATION_NOT_FOUND" };

  const deleted = await dalDeleteApplicationResume(applicationId, candidateUserId);
  if (!deleted) return { ok: true, deleted: false };

  if (storage.isResumeStorageConfigured()) {
    await safeDeleteResumeObject(deleted.objectKey);
  }

  return { ok: true, deleted: true };
}

async function buildDownload(
  record: ResumeRecord,
): Promise<DownloadResumeResult> {
  requireStorageConfigured();
  const object = await storage.getResumeObject(record.objectKey);
  if (!object) return { ok: false, code: "NOT_FOUND" };
  return {
    ok: true,
    download: {
      resume: record,
      body: object.body,
      contentType: record.mimeType,
      contentLength: object.contentLength ?? record.size,
    },
  };
}

export async function downloadApplicationResumeForCandidate(
  applicationId: string,
  candidateUserId: string,
): Promise<DownloadResumeResult> {
  const record = await getOwnedCandidateResume(applicationId, candidateUserId);
  if (!record) return { ok: false, code: "NOT_FOUND" };
  return buildDownload(record);
}

export async function downloadApplicationResumeForEmployer(
  applicationId: string,
  employerUserId: string,
): Promise<DownloadResumeResult> {
  const record = await getEmployerApplicationResume(applicationId, employerUserId);
  if (!record) return { ok: false, code: "NOT_FOUND" };
  return buildDownload(record);
}

/**
 * Best-effort provider deletion. Never throws; failures are logged with a
 * structured, PII-free event (no object key, no filename, no credentials).
 */
export async function safeDeleteResumeObject(objectKey: string): Promise<void> {
  try {
    await storage.deleteResumeObject(objectKey);
  } catch {
    const requestId = await getRequestId();
    logWarn("resume_delete_failed", {
      requestId,
      route: "/api/applications/[id]/resume",
      method: "DELETE",
      status: 500,
      errorCode: "STORAGE_DELETE_FAILED",
    });
  }
}
