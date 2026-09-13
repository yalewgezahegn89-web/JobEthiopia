import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance/run";
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
    route: "/api/internal/maintenance/run",
    keyEnvVar: "MAINTENANCE_API_KEY",
  });
  if (!authResult.ok) {
    return jsonError(authResult.message, authResult.status);
  }

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
          analyticsEventsPruned: result.analyticsEventsPruned,
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
      analyticsEventsPruned: result.analyticsEventsPruned,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    reportError("maintenance_failed", error, {
      requestId,
      route: "/api/internal/maintenance/run",
      method: "POST",
      status: 500,
      durationMs,
    });
    return jsonError("Internal server error", 500);
  }
}
