import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchDailyDigests } from "@/lib/jobAlerts/delivery";
import { writeAuditLog } from "@/lib/auth/audit";
import { logInfo, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Key check mirrors /api/internal/maintenance/run: the same operator
 * MAINTENANCE_API_KEY authorizes the digest trigger, compared in constant
 * time. Never returns hints about why a request was rejected.
 */
function checkKey(request: Request): Response | null {
  const configuredKey = process.env.MAINTENANCE_API_KEY;

  if (!configuredKey) {
    return jsonError("Server configuration error", 500);
  }

  const providedKey = request.headers.get("x-maintenance-key") ?? "";

  if (!providedKey) {
    return jsonError("Unauthorized", 401);
  }

  const bufA = Buffer.from(providedKey, "utf8");
  const bufB = Buffer.from(configuredKey, "utf8");

  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

export async function POST(request: Request) {
  const authError = checkKey(request);
  if (authError) return authError;

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
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("job_alerts_digest_failed", {
      requestId,
      route: "/api/internal/job-alerts/daily",
      method: "POST",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}