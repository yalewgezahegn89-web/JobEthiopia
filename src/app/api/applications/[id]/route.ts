import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { applicationIdParamSchema } from "@/lib/validations";
import { withdrawApplication, getOwnedApplication } from "@/lib/applications/dal";
import { getEmployerApplication } from "@/lib/employer/applications";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/applications/[id]";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_detail_failed", {
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

  const resolvedParams = await params;
  const parsedId = applicationIdParamSchema.safeParse({ id: resolvedParams.id });
  if (!parsedId.success) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    if (user.role === "CANDIDATE") {
      const owned = await getOwnedApplication(parsedId.data.id, user.id);
      if (!owned) {
        return reject(404, "Application not found", "NOT_FOUND");
      }
      return NextResponse.json({
        item: {
          id: owned.id,
          jobId: owned.jobId,
          status: owned.status,
          coverLetter: owned.coverLetter,
          createdAt: owned.createdAt.toISOString(),
          updatedAt: owned.updatedAt.toISOString(),
        },
      });
    }

    if (user.role === "ORGANIZATION_ADMIN") {
      const detail = await getEmployerApplication(user.id, parsedId.data.id);
      if (!detail) {
        return reject(404, "Application not found", "NOT_FOUND");
      }
      return NextResponse.json({
        item: {
          id: detail.id,
          jobId: detail.jobId,
          jobTitle: detail.jobTitle,
          organizationName: detail.organizationName,
          candidateName: detail.candidateName,
          candidateEmail: detail.candidateEmail,
          coverLetter: detail.coverLetter,
          status: detail.status,
          createdAt: detail.createdAt.toISOString(),
          updatedAt: detail.updatedAt.toISOString(),
        },
      });
    }

    return reject(403, "Forbidden", "FORBIDDEN");
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_detail_failed", {
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
    logWarn("application_withdrawn_failed", {
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

  const resolvedParams = await params;
  const parsedId = applicationIdParamSchema.safeParse({ id: resolvedParams.id });
  if (!parsedId.success) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    const result = await withdrawApplication(parsedId.data.id, user.id);

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return reject(404, "Application not found", "NOT_FOUND");
      }
      if (result.code === "NOT_WITHDRAWABLE") {
        return reject(409, "Application cannot be withdrawn", "NOT_WITHDRAWABLE");
      }
      return reject(409, "Application is already withdrawn", "ALREADY_WITHDRAWN");
    }

    logInfo("application_withdrawn", {
      requestId,
      route: ROUTE,
      method: "POST",
      applicationId: result.item.id,
      jobId: result.item.jobId,
      status: result.item.status,
      durationMs: Math.round(performance.now() - start),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_withdrawn_failed", {
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
