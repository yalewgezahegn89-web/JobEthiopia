import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { employerJobStatusSchema } from "@/lib/validations/employerJob";
import { changeEmployerJobStatus } from "@/lib/employer/jobs";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/jobs/[id]/status";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolvedParams = await params;
  const resolvedId = resolvedParams.id;

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    logWarn("employer_job_status_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  const user = await verifySession(rawToken);
  if (!user) {
    logWarn("employer_job_status_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  if (user.role !== "ORGANIZATION_ADMIN") {
    logWarn("employer_job_status_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: 403,
      errorCode: "NOT_ORG_ADMIN",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    logWarn("employer_job_status_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: 403,
      errorCode: "CSRF_REJECTED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  if (!UUID_RE.test(resolvedId)) {
    return jsonError("id must be a valid UUID", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = employerJobStatusSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 422);
  }

  try {
    const result = await changeEmployerJobStatus(
      user.id,
      resolvedId,
      parsed.data.status,
    );

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return jsonError("Job not found", 404);
      }
      if (result.code === "FORBIDDEN") {
        return jsonError("Forbidden", 403);
      }
      if (result.code === "ORG_INACTIVE") {
        return jsonError("Organization is not active", 403);
      }
      if (result.code === "INVALID_TRANSITION") {
        return jsonError("Invalid status transition", 409);
      }
      return jsonError("Internal server error", 500);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("employer_job_status_changed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: result.item.id,
      status: result.item.status,
      durationMs,
    });

    return NextResponse.json({
      item: { id: result.item.id, status: result.item.status },
    });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_job_status_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
