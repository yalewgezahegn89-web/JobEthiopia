import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { listEmployerApplications } from "@/lib/employer/applications";
import type { ApplicationSort } from "@/lib/employer/applications";
import { logWarn } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/applications";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("employer_applications_list_failed", {
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

  if (user.role !== "ORGANIZATION_ADMIN") {
    return reject(403, "Forbidden", "NOT_ORG_ADMIN");
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const jobIdParam = url.searchParams.get("jobId");
  const sortParam = url.searchParams.get("sort");
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  const validStatuses = [
    "SUBMITTED",
    "WITHDRAWN",
    "REVIEWING",
    "SHORTLISTED",
    "REJECTED",
  ] as const;
  type FilterStatus = (typeof validStatuses)[number];

  const status =
    statusParam && validStatuses.includes(statusParam as FilterStatus)
      ? (statusParam as FilterStatus)
      : undefined;

  const jobId =
    jobIdParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobIdParam,
    )
      ? jobIdParam
      : undefined;

  const validSorts: ApplicationSort[] = ["newest", "oldest", "updated"];
  const sort: ApplicationSort =
    sortParam && validSorts.includes(sortParam as ApplicationSort)
      ? (sortParam as ApplicationSort)
      : "newest";

  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;
  const limit = limitParam
    ? Math.min(100, Math.max(1, Number(limitParam) || 20))
    : 20;

  try {
    const result = await listEmployerApplications(user.id, {
      status,
      jobId,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      items: result.items.map((item) => ({
        id: item.id,
        jobId: item.jobId,
        jobTitle: item.jobTitle,
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        candidateName: item.candidateName,
        candidateEmail: item.candidateEmail,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch {
    return reject(500, "Internal server error", "INTERNAL_ERROR");
  }
}
