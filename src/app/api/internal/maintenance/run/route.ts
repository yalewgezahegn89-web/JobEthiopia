import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runMaintenance } from "@/lib/maintenance/run";
import { writeAuditLog } from "@/lib/auth/audit";
import { logInfo, logError } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkMaintenanceKey(request: Request): Response | null {
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
  const authError = checkMaintenanceKey(request);
  if (authError) return authError;

  const start = performance.now();
  const requestId = await getRequestId();
  logInfo("maintenance_started", {
    requestId,
    route: "/api/internal/maintenance/run",
    method: "POST",
  });

  try {
    const now = new Date();

    const result = await runMaintenance(now);
    const durationMs = Math.round(performance.now() - start);

    try {
      await writeAuditLog({
        action: "MAINTENANCE_RUN",
        targetType: "maintenance",
        targetId: "run",
        metadata: {
          expiredJobs: result.expiredJobs,
          sourcesChecked: result.sourcesChecked,
          sourcesSucceeded: result.sourcesSucceeded,
          sourcesFailed: result.sourcesFailed,
          sourcesSkipped: result.sourcesSkipped,
          durationMs,
        },
      });
    } catch {
      // Best-effort audit: a logging failure must not fail the run.
    }

    logInfo("maintenance_completed", {
      requestId,
      route: "/api/internal/maintenance/run",
      method: "POST",
      status: 200,
      durationMs,
      expiredJobs: result.expiredJobs,
      sourcesChecked: result.sourcesChecked,
      sourcesSucceeded: result.sourcesSucceeded,
      sourcesFailed: result.sourcesFailed,
      sourcesSkipped: result.sourcesSkipped,
    });

    return NextResponse.json(result);
  } catch {
    const durationMs = Math.round(performance.now() - start);
    logError("maintenance_failed", {
      requestId,
      route: "/api/internal/maintenance/run",
      method: "POST",
      status: 500,
      durationMs,
      errorCode: "INTERNAL_ERROR",
    });
    return jsonError("Internal server error", 500);
  }
}
