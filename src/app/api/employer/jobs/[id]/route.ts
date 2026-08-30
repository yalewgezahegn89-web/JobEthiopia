import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import {
  employerUpdateJobSchema,
} from "@/lib/validations/employerJob";
import {
  getEmployerJob,
  updateEmployerJob,
  removeEmployerJob,
} from "@/lib/employer/jobs";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/jobs/[id]";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticateAndAuthorize(_request: Request) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return { user: null, error: jsonError("Unauthorized", 401) };

  const user = await verifySession(rawToken);
  if (!user) return { user: null, error: jsonError("Unauthorized", 401) };

  if (user.role !== "ORGANIZATION_ADMIN") {
    return { user: null, error: jsonError("Forbidden", 403) };
  }

  return { user, error: null };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolvedParams = await params;
  const resolvedId = resolvedParams.id;

  const { user, error: authError } = await authenticateAndAuthorize(request);
  if (authError) {
    logWarn("employer_job_detail_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      jobId: resolvedId,
      status: authError.status,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return authError;
  }

  if (!UUID_RE.test(resolvedId)) {
    return jsonError("id must be a valid UUID", 400);
  }

  try {
    const job = await getEmployerJob(user!.id, resolvedId);
    if (!job) {
      return jsonError("Job not found", 404);
    }

    return NextResponse.json({
      item: {
        ...job,
        deadline: job.deadline ? job.deadline.toISOString() : null,
        postedAt: job.postedAt ? job.postedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolvedParams = await params;
  const resolvedId = resolvedParams.id;

  const { user, error: authError } = await authenticateAndAuthorize(request);
  if (authError) {
    logWarn("employer_job_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      status: authError.status,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return authError;
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    logWarn("employer_job_update_failed", {
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

  const parsed = employerUpdateJobSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 422);
  }

  if (Object.keys(parsed.data).length === 0) {
    return jsonError("No fields to update", 400);
  }

  try {
    const result = await updateEmployerJob(user!.id, resolvedId, parsed.data);

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
      if (result.code === "STATUS_BLOCKED") {
        return jsonError(
          "Only draft and pending review jobs can be edited",
          409,
        );
      }
      return jsonError("Internal server error", 500);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("employer_job_updated", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      jobId: resolvedId,
      durationMs,
    });

    return NextResponse.json({ item: result.item });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_job_update_failed", {
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();
  const resolvedParams = await params;
  const resolvedId = resolvedParams.id;

  const { user, error: authError } = await authenticateAndAuthorize(request);
  if (authError) {
    logWarn("employer_job_remove_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      jobId: resolvedId,
      status: authError.status,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return authError;
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    logWarn("employer_job_remove_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      jobId: resolvedId,
      status: 403,
      errorCode: "CSRF_REJECTED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  if (!UUID_RE.test(resolvedId)) {
    return jsonError("id must be a valid UUID", 400);
  }

  try {
    const result = await removeEmployerJob(user!.id, resolvedId);

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
      if (result.code === "STATUS_BLOCKED") {
        return jsonError(
          "Only draft and pending review jobs can be removed",
          409,
        );
      }
      return jsonError("Internal server error", 500);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("employer_job_removed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      jobId: resolvedId,
      durationMs,
    });

    return NextResponse.json({
      item: { id: result.item.id, status: result.item.status },
    });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_job_remove_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      jobId: resolvedId,
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
