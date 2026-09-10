import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { checkBodySize } from "@/lib/apiUtils";
import { updateJobAlertSchema, jobAlertIdParamSchema } from "@/lib/validations";
import { updateAlert, deleteAlert } from "@/lib/jobAlerts/dal";
import { writeAuditLog } from "@/lib/auth/audit";
import { logWarn, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

const ROUTE = "/api/job-alerts/[alertId]";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type Params = { params: Promise<{ alertId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("job_alert_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  const { alertId } = await params;
  const idChecked = jobAlertIdParamSchema.safeParse({ alertId });
  if (!idChecked.success) return reject(400, "Invalid alert id", "INVALID_ID");

  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "";
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

  const parsed = updateJobAlertSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return reject(400, `${path}${issue.message}`, "VALIDATION_FAILED");
  }

  try {
    const updated = await updateAlert(alertId, user.id, parsed.data);
    if (!updated) return reject(404, "Job alert not found", "NOT_FOUND");

    await writeAuditLog({
      action: "JOB_ALERT_UPDATED",
      targetType: "job_alert",
      targetId: updated.id,
      actorUserId: user.id,
      metadata: { frequency: updated.frequency, status: updated.status },
    }).catch(() => undefined);

    return NextResponse.json({ item: updated });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("job_alert_update_failed", {
      requestId,
      route: ROUTE,
      method: "PATCH",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const start = performance.now();
  const requestId = await getRequestId();

  const reject = (status: number, message: string, errorCode: string) => {
    logWarn("job_alert_delete_failed", {
      requestId,
      route: ROUTE,
      method: "DELETE",
      status,
      errorCode,
      durationMs: Math.round(performance.now() - start),
    });
    return jsonError(message, status);
  };

  const { alertId } = await params;
  const idChecked = jobAlertIdParamSchema.safeParse({ alertId });
  if (!idChecked.success) return reject(400, "Invalid alert id", "INVALID_ID");

  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? "";
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

  try {
    const deleted = await deleteAlert(alertId, user.id);
    if (!deleted) return reject(404, "Job alert not found", "NOT_FOUND");

    await writeAuditLog({
      action: "JOB_ALERT_DELETED",
      targetType: "job_alert",
      targetId: alertId,
      actorUserId: user.id,
    }).catch(() => undefined);

    return new NextResponse(null, { status: 204 });
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("job_alert_delete_failed", {
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