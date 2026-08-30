import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import {
  employerCreateJobSchema,
} from "@/lib/validations/employerJob";
import {
  listEmployerJobs,
  createEmployerJob,
} from "@/lib/employer/jobs";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/jobs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    logWarn("employer_jobs_list_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  const user = await verifySession(rawToken);
  if (!user) {
    logWarn("employer_jobs_list_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  if (user.role !== "ORGANIZATION_ADMIN") {
    logWarn("employer_jobs_list_failed", {
      requestId,
      route: ROUTE,
      method: "GET",
      status: 403,
      errorCode: "NOT_ORG_ADMIN",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  const validStatuses = [
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "EXPIRED",
    "REMOVED",
  ] as const;
  type FilterStatus = (typeof validStatuses)[number];

  const status =
    statusParam && validStatuses.includes(statusParam as FilterStatus)
      ? (statusParam as FilterStatus)
      : undefined;

  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;
  const limit = limitParam
    ? Math.min(100, Math.max(1, Number(limitParam) || 20))
    : 20;

  try {
    const result = await listEmployerJobs(user.id, { status, page, limit });

    return NextResponse.json({
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        status: item.status,
        deadline: item.deadline ? item.deadline.toISOString() : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        applicationCount: item.applicationCount,
        needsReviewCount: item.needsReviewCount,
      })),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function POST(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    logWarn("employer_job_created_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  const user = await verifySession(rawToken);
  if (!user) {
    logWarn("employer_job_created_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  if (user.role !== "ORGANIZATION_ADMIN") {
    logWarn("employer_job_created_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 403,
      errorCode: "NOT_ORG_ADMIN",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    logWarn("employer_job_created_failed", {
      requestId,
      route: ROUTE,
      method: "POST",
      status: 403,
      errorCode: "CSRF_REJECTED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = employerCreateJobSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 422);
  }

  try {
    const result = await createEmployerJob(user.id, parsed.data);

    if (!result.ok) {
      if (result.code === "FORBIDDEN") {
        return jsonError("Forbidden", 403);
      }
      if (result.code === "ORG_INACTIVE") {
        return jsonError("Organization is not active", 403);
      }
      if (result.code === "SLUG_COLLISION") {
        return jsonError("Unable to create job with a unique slug", 409);
      }
      return jsonError("Internal server error", 500);
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("employer_job_created", {
      requestId,
      route: ROUTE,
      method: "POST",
      jobId: result.item.id,
      organizationId: result.item.organizationId,
      durationMs,
    });

    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("employer_job_created_failed", {
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
