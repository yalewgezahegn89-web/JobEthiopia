import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { bulkApplicationStatusChangeSchema } from "@/lib/validations/applicationStatus";
import { changeEmployerApplicationStatuses } from "@/lib/employer/applications";
import { dispatchApplicationStatusNotification } from "@/lib/email";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/employer/applications/status";

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ error: message, errorCode }, { status });
}

/**
 * Bulk application status change (B93).
 *
 * Only ORGANIZATION_ADMIN users may change application statuses. The request
 * carries no organizationId; the batch is scoped to a single organization
 * derived entirely from the session user and the selected applications.
 *
 * Candidate notifications are dispatched ONLY after the DB transaction has
 * committed (max 50 per request). A notification failure never rolls back the
 * committed status changes.
 */
export async function PATCH(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (
    status: number,
    message: string,
    errorCode: string,
    extra: Record<string, unknown> = {},
  ) => {
    logWarn("employer_applications_bulk_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
      ...extra,
    });
    return jsonError(message, status, errorCode);
  };

  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  const user = await verifySession(rawToken);
  if (!user) return reject(401, "Unauthorized", "UNAUTHENTICATED");

  if (user.role !== "ORGANIZATION_ADMIN") {
    return reject(403, "Forbidden", "NOT_ORG_ADMIN");
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return reject(403, "Forbidden", "CSRF_REJECTED");
  }

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  const parsed = bulkApplicationStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(422, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  const { applicationIds, status } = parsed.data;
  const count = applicationIds.length;

  let result;
  try {
    result = await changeEmployerApplicationStatuses(
      user.id,
      applicationIds,
      status,
    );
  } catch {
    logError("employer_applications_bulk_status_change_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 500,
      durationMs: Math.round(performance.now() - start),
      errorCode: "INTERNAL_ERROR",
      count,
    });
    return jsonError("Internal server error", 500, "INTERNAL_ERROR");
  }

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return reject(404, "Application not found", "NOT_FOUND", { count });
    }
    if (result.code === "FORBIDDEN") {
      return reject(403, "Forbidden", "FORBIDDEN", { count });
    }
    if (result.code === "ORG_INACTIVE") {
      return reject(403, "Organization is not active", "ORG_INACTIVE", {
        count,
      });
    }
    if (result.code === "USER_INACTIVE") {
      return reject(403, "Forbidden", "USER_INACTIVE", { count });
    }
    if (result.code === "MIXED_ORG") {
      return reject(403, "Forbidden", "MIXED_ORG", { count });
    }
    if (result.code === "INVALID_TRANSITION") {
      return reject(
        409,
        "Invalid status transition",
        "INVALID_TRANSITION",
        { count },
      );
    }
    return reject(500, "Internal server error", "INTERNAL_ERROR", { count });
  }

  const itemIds = result.items.map((item) => item.id);

  // POST-COMMIT: dispatch candidate notifications for the changed applications
  // (bounded to the max-50 batch). Never rolls back committed status changes.
  try {
    const recipients = await db
      .select({
        applicationId: applications.id,
        candidateEmail: users.email,
        candidateName: users.name,
        jobTitle: jobs.title,
        organizationName: organizations.name,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .innerJoin(users, eq(users.id, applications.candidateUserId))
      .where(inArray(applications.id, itemIds));

    for (const r of recipients) {
      if (r.candidateEmail) {
        await dispatchApplicationStatusNotification({
          applicationId: r.applicationId,
          candidateEmail: r.candidateEmail,
          candidateName: r.candidateName ?? "Applicant",
          jobTitle: r.jobTitle,
          organizationName: r.organizationName,
          newStatus: status,
        });
      }
    }
  } catch {
    // Notification failure must not affect the committed response.
  }

  const durationMs = Math.round(performance.now() - start);
  logInfo("employer_applications_bulk_status_changed", {
    requestId,
    route: ROUTE,
    method: "PATCH",
    status: 200,
    count,
    targetStatus: status,
    durationMs,
  });

  return NextResponse.json({
    updated: result.items.map((item) => ({ id: item.id, status: item.status })),
    count,
    status,
  });
}
