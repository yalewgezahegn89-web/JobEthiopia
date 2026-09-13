import { NextResponse } from "next/server";
import { dispatchDailyDigests } from "@/lib/jobAlerts/delivery";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkInternalRouteKey } from "@/lib/auth/internalKey";
import { reportError } from "@/lib/observability/errors";
import { logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const authResult = await checkInternalRouteKey(request, {
    route: "/api/internal/job-alerts/daily",
    keyEnvVar: "INTERNAL_JOB_ALERTS_API_KEY",
  });
  if (!authResult.ok) {
    return jsonError(authResult.message, authResult.status);
  }

  const start = performance.now();
  const requestId = await getRequestId();
  logInfo("job_alerts_digest_started", {
    requestId,
    route: "/api/internal/job-alerts/daily",
    method: "POST",
  });

  try {
    const result = await dispatchDailyDigests();
    const durationMs = Math.round(performance.now() - start);

    try {
      await writeAuditLog({
        action: "JOB_ALERT_DIGEST_RUN",
        targetType: "job_alert",
        targetId: "daily",
        metadata: {
          alertsProcessed: result.alertsProcessed,
          alertsSkipped: result.alertsSkipped,
          sent: result.sent,
          skippedNoEmail: result.skippedNoEmail,
          failed: result.failed,
          emailsSent: result.emailsSent,
          durationMs,
        },
      });
    } catch {
      // Best-effort audit.
    }

    logInfo("job_alerts_digest_completed", {
      requestId,
      route: "/api/internal/job-alerts/daily",
      method: "POST",
      status: 200,
      durationMs,
      alertsProcessed: result.alertsProcessed,
      alertsSkipped: result.alertsSkipped,
      sent: result.sent,
      skippedNoEmail: result.skippedNoEmail,
      failed: result.failed,
      emailsSent: result.emailsSent,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    reportError("job_alerts_digest_failed", error, {
      requestId,
      route: "/api/internal/job-alerts/daily",
      method: "POST",
      status: 500,
      durationMs,
    });
    return jsonError("Internal server error", 500);
  }
}