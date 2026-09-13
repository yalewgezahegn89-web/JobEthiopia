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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
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
      });

      return NextResponse.json({ item });
    }

    const result = await runSourcesIngestion();
    const durationMs = Math.round(performance.now() - start);

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
    });

    return NextResponse.json({
      checked: result.checked,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
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