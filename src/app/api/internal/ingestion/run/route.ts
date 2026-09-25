import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { NextResponse } from "next/server";
import {
  runSourceIngestion,
  runSourcesIngestion,
} from "@/lib/ingestion/runSource";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkInternalRouteKey } from "@/lib/auth/internalKey";
import { reportError } from "@/lib/observability/errors";
import { logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";
import { recordIngestionRun } from "@/lib/observability/metrics";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type SingleSourceRun = Awaited<ReturnType<typeof runSourceIngestion>>;

/**
 * Feeds the bounded in-process ingestion ring (Phase 16 Batch 2). Counts only
 * — no source URL, no record payloads, no identity.
 */
function recordSingleSourceRun(item: SingleSourceRun, durationMs: number): void {
  recordIngestionRun({
    at: Date.now(),
    status:
      item.status === "FAILED"
        ? "FAILED"
        : item.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : "PARTIAL",
    durationMs,
    sourcesAttempted: 1,
    sourcesSucceeded: item.status === "SUCCEEDED" ? 1 : 0,
    sourcesFailed: item.status === "FAILED" ? 1 : 0,
    sourcesSkipped: item.status === "SKIPPED" ? 1 : 0,
    jobsReceived: item.total,
    jobsCreated: item.created,
    jobsUpdated: item.updated,
    duplicates: item.duplicate,
    failedRecords: item.failed,
    autoDeactivatedSources: item.deactivated ? 1 : 0,
  });
}

async function __wrapped_POST(request: Request) {
  const authResult = await checkInternalRouteKey(request, {
    route: "/api/internal/ingestion/run",
    keyEnvVar: "INTERNAL_INGESTION_API_KEY",
  });
  if (!authResult.ok) {
    return jsonError(authResult.message, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const rawSourceId = searchParams.get("sourceId");

  const sourceIdParsed = rawSourceId
    ? sourceIdParamSchema.safeParse({ id: rawSourceId })
    : null;

  if (sourceIdParsed && !sourceIdParsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  const start = performance.now();
  const requestId = await getRequestId();
  logInfo("ingestion_run_started", {
    requestId,
    route: "/api/internal/ingestion/run",
    method: "POST",
    sourceId: rawSourceId ?? "all",
  });

  try {
    if (sourceIdParsed) {
      const item = await runSourceIngestion(sourceIdParsed.data.id);
      const durationMs = Math.round(performance.now() - start);
      recordSingleSourceRun(item, durationMs);

      try {
        await writeAuditLog({
          action: "INGESTION_RUN",
          targetType: "ingestion",
          targetId: "run",
          metadata: {
            scope: "source",
            sourceId: item.sourceId,
            status: item.status,
            reason: item.reason,
            total: item.total,
            created: item.created,
            updated: item.updated,
            duplicate: item.duplicate,
            linked: item.linked,
            possibleDuplicate: item.possibleDuplicate,
            failed: item.failed,
            durationMs,
            deactivated: item.deactivated,
          },
        });
      } catch {
        // Best-effort audit: a logging failure must not fail the run.
      }

      logInfo("ingestion_run_completed", {
        requestId,
        route: "/api/internal/ingestion/run",
        method: "POST",
        status: 200,
        durationMs,
        sourceId: item.sourceId,
        statusRun: item.status,
        deactivated: item.deactivated,
      });

      return NextResponse.json({ item });
    }

    const result = await runSourcesIngestion();
    const durationMs = Math.round(performance.now() - start);

    recordIngestionRun({
      at: Date.now(),
      status:
        result.failed === 0
          ? "SUCCEEDED"
          : result.succeeded > 0
            ? "PARTIAL"
            : "FAILED",
      durationMs,
      sourcesAttempted: result.checked,
      sourcesSucceeded: result.succeeded,
      sourcesFailed: result.failed,
      sourcesSkipped: result.skipped,
      jobsReceived: result.jobsReceived,
      jobsCreated: result.jobsCreated,
      jobsUpdated: result.jobsUpdated,
      duplicates: result.duplicates,
      failedRecords: result.failedRecords,
      autoDeactivatedSources: result.autoDeactivatedSources,
    });

    try {
      await writeAuditLog({
        action: "INGESTION_RUN",
        targetType: "ingestion",
        targetId: "run",
        metadata: {
          scope: "due",
          checked: result.checked,
          succeeded: result.succeeded,
          failed: result.failed,
          skipped: result.skipped,
          durationMs,
          jobsReceived: result.jobsReceived,
          jobsCreated: result.jobsCreated,
          jobsUpdated: result.jobsUpdated,
          duplicates: result.duplicates,
          failedRecords: result.failedRecords,
          autoDeactivatedSources: result.autoDeactivatedSources,
        },
      });
    } catch {
      // Best-effort audit: a logging failure must not fail the run.
    }

    logInfo("ingestion_run_completed", {
      requestId,
      route: "/api/internal/ingestion/run",
      method: "POST",
      status: 200,
      durationMs,
      sourceId: "all",
      checked: result.checked,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      jobsReceived: result.jobsReceived,
      jobsCreated: result.jobsCreated,
      jobsUpdated: result.jobsUpdated,
      duplicates: result.duplicates,
      failedRecords: result.failedRecords,
      autoDeactivatedSources: result.autoDeactivatedSources,
    });

    return NextResponse.json({
      checked: result.checked,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    // Metric only — a failed run deliberately writes NO audit event.
    recordIngestionRun({
      at: Date.now(),
      status: "FAILED",
      durationMs,
      sourcesAttempted: 0,
      sourcesSucceeded: 0,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      jobsReceived: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      duplicates: 0,
      failedRecords: 0,
      autoDeactivatedSources: 0,
    });
    reportError("ingestion_run_failed", error, {
      requestId,
      route: "/api/internal/ingestion/run",
      method: "POST",
      status: 500,
      durationMs,
    });
    return jsonError("Internal server error", 500);
  }
}
export const POST = withRouteMetrics("/api/internal/ingestion/run", "POST", __wrapped_POST);
