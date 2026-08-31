import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { createApplicationSchema } from "@/lib/validations";
import { createApplication } from "@/lib/applications/dal";
import { dispatchApplicationSubmissionNotification } from "@/lib/email";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";
import { logInfo, logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/applications";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("application_submitted_failed", {
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

  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reject(400, "Invalid JSON body", "INVALID_BODY");
  }

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(400, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  const { jobId, coverLetter } = parsed.data;

  try {
    const result = await createApplication({
      jobId,
      candidateUserId: user.id,
      coverLetter,
    });

    if (!result.ok) {
      if (result.code === "JOB_NOT_FOUND") {
        return reject(404, "Job not found", "JOB_NOT_FOUND");
      }
      if (result.code === "JOB_NOT_OPEN") {
        return reject(422, "Job is not open for applications", "JOB_NOT_OPEN");
      }
      return reject(409, "You have already applied to this job", "DUPLICATE");
    }

    logInfo("application_submitted", {
      requestId,
      route: ROUTE,
      method: "POST",
      jobId: result.item.jobId,
      status: result.item.status,
      durationMs: Math.round(performance.now() - start),
    });

    try {
      const row = await db
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

      if (row.length > 0 && row[0].candidateEmail) {
        await dispatchApplicationSubmissionNotification(row[0].candidateEmail, {
          candidateName: row[0].candidateName ?? "Applicant",
          jobTitle: row[0].jobTitle,
          organizationName: row[0].organizationName,
          applicationId: result.item.id,
          submittedAt: result.item.createdAt.toISOString(),
        });
      }
    } catch {
      // Confirmation email failure must not affect the 201 response.
    }

    return NextResponse.json(
      {
        item: {
          id: result.item.id,
          jobId: result.item.jobId,
          status: result.item.status,
          createdAt: result.item.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("application_submitted_failed", {
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