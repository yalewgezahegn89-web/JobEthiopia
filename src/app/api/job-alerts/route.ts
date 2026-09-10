import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { createJobAlertSchema } from "@/lib/validations";
import { createAlert, listAlertsForUser } from "@/lib/jobAlerts/dal";
import { writeAuditLog } from "@/lib/auth/audit";
import { logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/job-alerts";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("job_alert_create_failed", {
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

  const parsed = createJobAlertSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(400, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  try {
    const created = await createAlert(user.id, parsed.data);

    await writeAuditLog({
      action: "JOB_ALERT_CREATED",
      targetType: "job_alert",
      targetId: created.id,
      actorUserId: user.id,
      metadata: { frequency: created.frequency },
    }).catch(() => undefined);

    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("job_alert_create_failed", {
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

export async function GET() {
  const start = performance.now();
  const requestId = await getRequestId();

  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    logWarn("job_alert_list_failed", {
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
  if (!user) return jsonError("Unauthorized", 401);

  if (user.role !== "CANDIDATE") {
    return jsonError("Forbidden", 403);
  }

  try {
    const items = await listAlertsForUser(user.id);
    return NextResponse.json({ items });
  } catch {
    return jsonError("Internal server error", 500);
  }
}