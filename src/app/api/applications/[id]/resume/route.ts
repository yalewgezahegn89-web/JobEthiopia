import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { applicationIdParamSchema } from "@/lib/validations";
import { checkBodySize } from "@/lib/apiUtils";
import {
  uploadApplicationResume,
  deleteApplicationResume,
  downloadApplicationResumeForCandidate,
  downloadApplicationResumeForEmployer,
} from "@/lib/resume/service";
import {
  MAX_RESUME_BYTES,
  sanitizeResumeFilename,
  ResumeValidationError,
} from "@/lib/resume/validation";
import { ResumeStorageError } from "@/lib/resume/storage";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/applications/[id]/resume";
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function contentDispositionHeader(name: string): string {
  const fallback = "resume.pdf";
  const encoded = encodeURIComponent(name);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("resume_download_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  const user = await verifySession(rawToken);
  if (!user) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  if (user.role !== "CANDIDATE" && user.role !== "ORGANIZATION_ADMIN") {
    return reject(403, "Forbidden", "FORBIDDEN");
  }

  const resolvedParams = await params;
  const parsedId = applicationIdParamSchema.safeParse({ id: resolvedParams.id });
  if (!parsedId.success) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    const result =
      user.role === "CANDIDATE"
        ? await downloadApplicationResumeForCandidate(parsedId.data.id, user.id)
        : await downloadApplicationResumeForEmployer(parsedId.data.id, user.id);

    if (!result.ok) {
      return reject(404, "Resume not found", "NOT_FOUND");
    }

    const { resume, body, contentType, contentLength } = result.download;

    logInfo("resume_download_succeeded", {
      requestId,
      route: ROUTE,
      method: "GET",
      status: 200,
      durationMs: Math.round(performance.now() - start),
    });

    return new Response(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDispositionHeader(
          sanitizeResumeFilename(resume.originalName),
        ),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        ...(contentLength !== undefined
          ? { "Content-Length": String(contentLength) }
          : {}),
      },
    });
  } catch (err) {
    if (err instanceof ResumeStorageError) {
      const code = err.code;
      logWarn("resume_download_failed", {
        requestId,
        route: ROUTE,
        method: "GET",
        status: code === "RESUME_STORAGE_NOT_CONFIGURED" ? 503 : 500,
        errorCode: code,
        durationMs: Math.round(performance.now() - start),
      });
      return jsonError(
        code === "RESUME_STORAGE_NOT_CONFIGURED"
          ? "Service unavailable"
          : "Internal server error",
        code === "RESUME_STORAGE_NOT_CONFIGURED" ? 503 : 500,
      );
    }
    const durationMs = Math.round(performance.now() - start);
    logError("resume_download_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("resume_upload_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  const user = await verifySession(rawToken);
  if (!user) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  if (user.role !== "CANDIDATE") {
    return reject(403, "Forbidden", "NOT_CANDIDATE");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "Forbidden", "CSRF_REJECTED");
  }

  const bodySizeError = checkBodySize(request, MAX_RESUME_BYTES + MULTIPART_OVERHEAD_BYTES);
  if (bodySizeError) return bodySizeError;

  const resolvedParams = await params;
  const parsedId = applicationIdParamSchema.safeParse({ id: resolvedParams.id });
  if (!parsedId.success) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    const candidate = formData.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return reject(400, "Invalid form data", "INVALID_BODY");
  }

  if (!file) {
    return reject(400, "A resume file is required", "INVALID_FILENAME");
  }

  try {
    const result = await uploadApplicationResume(
      parsedId.data.id,
      user.id,
      file,
    );

    if (!result.ok) {
      return reject(404, "Application not found", "APPLICATION_NOT_FOUND");
    }

    const { resume, created } = result;

    logInfo("resume_upload_succeeded", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: created ? 201 : 200,
      durationMs: Math.round(performance.now() - start),
    });

    return NextResponse.json(
      {
        item: {
          id: resume.id,
          applicationId: resume.applicationId,
          originalName: resume.originalName,
          mimeType: resume.mimeType,
          size: resume.size,
          createdAt: resume.createdAt.toISOString(),
          updatedAt: resume.updatedAt.toISOString(),
        },
        created,
      },
      { status: created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof ResumeValidationError) {
      const code = err.code;
      const status = code === "TOO_LARGE" ? 413 : 422;
      return reject(status, "Invalid resume", code);
    }
    if (err instanceof ResumeStorageError) {
      const code = err.code;
      return reject(
        code === "RESUME_STORAGE_NOT_CONFIGURED" ? 503 : 500,
        code === "RESUME_STORAGE_NOT_CONFIGURED"
          ? "Service unavailable"
          : "Internal server error",
        code,
      );
    }
    const durationMs = Math.round(performance.now() - start);
    logError("resume_upload_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("resume_delete_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  const user = await verifySession(rawToken);
  if (!user) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  if (user.role !== "CANDIDATE") {
    return reject(403, "Forbidden", "NOT_CANDIDATE");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "Forbidden", "CSRF_REJECTED");
  }

  const resolvedParams = await params;
  const parsedId = applicationIdParamSchema.safeParse({ id: resolvedParams.id });
  if (!parsedId.success) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    const result = await deleteApplicationResume(parsedId.data.id, user.id);
    if (!result.ok) {
      return reject(404, "Application not found", "APPLICATION_NOT_FOUND");
    }

    logInfo("resume_delete_succeeded", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status: 200,
      durationMs: Math.round(performance.now() - start),
    });

    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("resume_delete_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
