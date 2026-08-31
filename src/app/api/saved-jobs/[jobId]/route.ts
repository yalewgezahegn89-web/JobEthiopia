import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { savedJobIdParamSchema } from "@/lib/validations";
import { unsaveJob } from "@/lib/savedJobs/dal";
import { logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/saved-jobs/[jobId]";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("saved_job_unsave_failed", {
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
  const parsed = savedJobIdParamSchema.safeParse({ jobId: resolvedParams.jobId });
  if (!parsed.success) {
    return reject(400, "Job ID must be a valid UUID", "VALIDATION_FAILED");
  }

  try {
    await unsaveJob(user.id, parsed.data.jobId);

    return new NextResponse(null, { status: 204 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("saved_job_unsave_failed", {
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
