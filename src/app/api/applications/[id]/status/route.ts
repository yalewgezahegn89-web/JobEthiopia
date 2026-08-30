import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { employerStatusChangeSchema } from "@/lib/validations/applicationStatus";
import { assertEmployerApplicationAccess } from "@/lib/auth/employerAccess";
import { changeEmployerApplicationStatus } from "@/lib/employer/applications";
import { dispatchApplicationStatusNotification } from "@/lib/email";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/applications/[id]/status";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    logWarn("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  const user = await verifySession(rawToken);
  if (!user) {
    logWarn("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 401,
      errorCode: "UNAUTHENTICATED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Unauthorized", 401);
  }

  if (user.role !== "ORGANIZATION_ADMIN") {
    logWarn("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 403,
      errorCode: "NOT_ORG_ADMIN",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    logWarn("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 403,
      errorCode: "CSRF_REJECTED",
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const resolvedParams = await params;
  const resolvedId = resolvedParams.id;

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      applicationId: resolvedId,
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      resolvedId,
    )
  ) {
    return reject(400, "id must be a valid UUID", "VALIDATION_FAILED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  const parsed = employerStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(422, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  try {
    const access = await assertEmployerApplicationAccess(user.id, resolvedId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") {
        return reject(404, "Application not found", "NOT_FOUND");
      }
      return reject(403, "Forbidden", "FORBIDDEN");
    }
  } catch {
    return reject(500, "Internal server error", "INTERNAL_ERROR");
  }

  try {
    const result = await changeEmployerApplicationStatus(
      user.id,
      resolvedId,
      parsed.data.status,
    );

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return reject(404, "Application not found", "NOT_FOUND");
      }
      if (result.code === "FORBIDDEN") {
        return reject(403, "Forbidden", "FORBIDDEN");
      }
      if (result.code === "ORG_INACTIVE") {
        return reject(403, "Organization is not active", "ORG_INACTIVE");
      }
      if (result.code === "INVALID_TRANSITION") {
        return reject(
          409,
          "Invalid status transition",
          "INVALID_TRANSITION",
        );
      }
      return reject(500, "Internal server error", "INTERNAL_ERROR");
    }

    const durationMs = Math.round(performance.now() - start);
    logInfo("application_status_changed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      applicationId: result.item.id,
      status: result.item.status,
      durationMs,
    });

    const notifyStatuses = ["REVIEWING", "SHORTLISTED", "REJECTED"];
    if (notifyStatuses.includes(result.item.status)) {
      try {
        const candidateRow = await db
          .select({
            candidateEmail: users.email,
            candidateName: users.name,
            jobTitle: jobs.title,
            organizationName: organizations.name,
          })
          .from(applications)
          .innerJoin(jobs, eq(jobs.id, applications.jobId))
          .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
          .innerJoin(users, eq(users.id, applications.candidateUserId))
          .where(eq(applications.id, result.item.id))
          .limit(1);

        if (candidateRow.length > 0 && candidateRow[0].candidateEmail) {
          const c = candidateRow[0];
          if (c.candidateEmail) {
            await dispatchApplicationStatusNotification({
              applicationId: result.item.id,
              candidateEmail: c.candidateEmail,
              candidateName: c.candidateName ?? "Applicant",
              jobTitle: c.jobTitle,
              organizationName: c.organizationName,
              newStatus: result.item.status,
            });
          }
        }
      } catch {
        // Notification failure must not affect the response
      }
    }

    return NextResponse.json({
      item: {
        id: result.item.id,
        status: result.item.status,
      },
    });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      applicationId: resolvedId,
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
