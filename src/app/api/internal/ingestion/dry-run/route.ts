import { NextResponse } from "next/server";
import { dryRunSourceIngestion } from "@/lib/ingestion/dryRun";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkInternalRouteKey } from "@/lib/auth/internalKey";
import { reportError } from "@/lib/observability/errors";
import { logInfo } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/requestId";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Validates a single source against the automated ingestion pipeline WITHOUT
 * writing anything to the database.
 *
 * This is the operator-facing preview tool for controlled automated ingestion:
 * it fetches the real source, validates/normalizes each item, and checks the
 * dedup cascade read-only. It never creates jobs, organizations, locations,
 * or modifies source health fields, and it never publishes.
 */
export async function POST(request: Request) {
  const authResult = await checkInternalRouteKey(request, {
    route: "/api/internal/ingestion/dry-run",
    keyEnvVar: "INTERNAL_INGESTION_API_KEY",
  });
  if (!authResult.ok) {
    return jsonError(authResult.message, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const rawSourceId = searchParams.get("sourceId");

  if (!rawSourceId) {
    return jsonError("sourceId is required", 400);
  }

  const sourceIdParsed = sourceIdParamSchema.safeParse({ id: rawSourceId });
  if (!sourceIdParsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  const start = performance.now();
  const requestId = await getRequestId();
  logInfo("ingestion_dry_run_started", {
    requestId,
    route: "/api/internal/ingestion/dry-run",
    method: "POST",
    sourceId: sourceIdParsed.data.id,
  });

  try {
    const result = await dryRunSourceIngestion(sourceIdParsed.data.id);
    const durationMs = Math.round(performance.now() - start);

    try {
      await writeAuditLog({
        action: "INGESTION_DRY_RUN",
        targetType: "ingestion",
        targetId: "dry-run",
        metadata: {
          sourceId: result.sourceId,
          fetchSuccess: result.fetchSuccess,
          fetchError: result.fetchError,
          totalFetched: result.totalFetched,
          totalValid: result.totalValid,
          totalInvalid: result.totalInvalid,
          totalDuplicate: result.totalDuplicate,
          totalNew: result.totalNew,
          durationMs,
        },
      });
    } catch {
      // Best-effort audit: a logging failure must not fail the dry run.
    }

    logInfo("ingestion_dry_run_completed", {
      requestId,
      route: "/api/internal/ingestion/dry-run",
      method: "POST",
      status: 200,
      durationMs,
      sourceId: result.sourceId,
    });

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const durationMs = Math.round(performance.now() - start);
    reportError("ingestion_dry_run_failed", error, {
      requestId,
      route: "/api/internal/ingestion/dry-run",
      method: "POST",
      status: 500,
      durationMs,
    });
    return jsonError("Internal server error", 500);
  }
}