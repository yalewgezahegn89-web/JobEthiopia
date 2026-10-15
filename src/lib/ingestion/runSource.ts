import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { ingestJobs } from "@/lib/ingestion/batch";
import { getAdapterForSource } from "@/lib/sources/adapters";
import { SUPPORTED_ADAPTER_SOURCE_TYPES } from "@/lib/sources/adapters";
import {
  recordSuccessfulCheck,
  recordFailedCheck,
  isSourceDueForCheck,
  autoDeactivateIfUnhealthy,
} from "@/lib/sources/health";
import { logInfo, logWarn } from "@/lib/observability/logger";

const MAX_SOURCES_PER_RUN = 100;

export type SourceRunStatus = "SUCCEEDED" | "FAILED" | "SKIPPED";

export interface SourceRunResult {
  sourceId: string;
  status: SourceRunStatus;
  reason: string | null;
  total: number;
  created: number;
  updated: number;
  duplicate: number;
  linked: number;
  possibleDuplicate: number;
  failed: number;
  durationMs: number;
  /** True when this attempt auto-deactivated the source (failure threshold). */
  deactivated: boolean;
}

/**
 * Aggregate counters for one whole ingestion run (Phase 16 Batch 2).
 *
 * `checked/succeeded/failed/skipped` remain the stable response contract; the
 * added fields are additive and feed the audit metadata, the structured run
 * log and the in-process ingestion metrics. No schema change is involved.
 */
export interface SourcesIngestionResult {
  checked: number;
  succeeded: number;
  failed: number;
  skipped: number;
  jobsReceived: number;
  jobsCreated: number;
  jobsUpdated: number;
  duplicates: number;
  failedRecords: number;
  autoDeactivatedSources: number;
}

function zeroAggregates(): Pick<
  SourcesIngestionResult,
  | "jobsReceived"
  | "jobsCreated"
  | "jobsUpdated"
  | "duplicates"
  | "failedRecords"
  | "autoDeactivatedSources"
> {
  return {
    jobsReceived: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    duplicates: 0,
    failedRecords: 0,
    autoDeactivatedSources: 0,
  };
}

function zeroCounts(): Pick<
  SourceRunResult,
  | "total"
  | "created"
  | "updated"
  | "duplicate"
  | "linked"
  | "possibleDuplicate"
  | "failed"
> {
  return {
    total: 0,
    created: 0,
    updated: 0,
    duplicate: 0,
    linked: 0,
    possibleDuplicate: 0,
    failed: 0,
  };
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

async function recordFailedCheckSafe(
  sourceId: string,
  message: string,
): Promise<boolean> {
  try {
    await recordFailedCheck(sourceId, message);
  } catch {
    // Health recording must never fail an ingestion run.
  }
  // Auto-deactivate sources that exceed the failure threshold (best-effort).
  try {
    return (await autoDeactivateIfUnhealthy(sourceId)) === true;
  } catch {
    return false;
  }
}

async function recordSuccessfulCheckSafe(sourceId: string): Promise<void> {
  try {
    await recordSuccessfulCheck(sourceId);
  } catch {
    // Health recording must never fail an ingestion run.
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Connection failed";
}

/**
 * Runs automated ingestion for a single source.
 *
 * Delegates to the source's adapter (by sourceType), then feeds the fetched
 * listings through the existing batch ingestion pipeline. Health is recorded
 * after each attempt — success keeps `lastSuccessfulCheck` fresh, failures
 * increment `consecutiveFailures` and store the error. Imports never publish:
 * the pipeline only ever creates DRAFT/PENDING rows.
 *
 * This function does NOT write audit events — the caller (the internal run
 * endpoint) owns audit logging for the whole run.
 *
 * @param sourceId - The ID of the source to fetch from
 * @returns The per-source run summary
 */
export async function runSourceIngestion(
  sourceId: string,
): Promise<SourceRunResult> {
  const start = performance.now();

  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, name: true, sourceType: true, isActive: true },
  });

  if (!source) {
    return {
      sourceId,
      status: "FAILED",
      reason: "Source not found",
      ...zeroCounts(),
      durationMs: 0,
      deactivated: false,
    };
  }

  if (!source.isActive) {
    return {
      sourceId,
      status: "SKIPPED",
      reason: "Source is inactive",
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated: false,
    };
  }

  const adapter = getAdapterForSource(source.sourceType);
  if (!adapter) {
    return {
      sourceId,
      status: "SKIPPED",
      reason: `Unsupported source type: ${source.sourceType}`,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated: false,
    };
  }

  let fetch;
  try {
    fetch = await adapter.fetchJobs(sourceId);
  } catch (err: unknown) {
    const message = errorMessage(err);
    const deactivated = await recordFailedCheckSafe(sourceId, message);
    logWarn("ingestion_source_fetch_failed", {
      sourceId,
      reason: message,
    });
    return {
      sourceId,
      status: "FAILED",
      reason: message,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated,
    };
  }

  if (!fetch.success) {
    const deactivated = await recordFailedCheckSafe(sourceId, fetch.error);
    logWarn("ingestion_source_fetch_failed", {
      sourceId,
      reason: fetch.error,
    });
    return {
      sourceId,
      status: "FAILED",
      reason: fetch.error,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated,
    };
  }

  if (fetch.jobs.length === 0) {
    await recordSuccessfulCheckSafe(sourceId);
    return {
      sourceId,
      status: "SUCCEEDED",
      reason: null,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated: false,
    };
  }

  try {
    const result = await ingestJobs({ sourceId, jobs: fetch.jobs });
    logInfo("ingestion_source_completed", {
      sourceId,
      total: result.summary.total,
      created: result.summary.created,
      updated: result.summary.updated,
      duplicate: result.summary.duplicate,
      linked: result.summary.linked,
      possibleDuplicate: result.summary.possibleDuplicate,
      failed: result.summary.failed,
      durationMs: elapsedMs(start),
    });
    return {
      sourceId,
      status: "SUCCEEDED",
      reason: null,
      total: result.summary.total,
      created: result.summary.created,
      updated: result.summary.updated,
      duplicate: result.summary.duplicate,
      linked: result.summary.linked,
      possibleDuplicate: result.summary.possibleDuplicate,
      failed: result.summary.failed,
      durationMs: elapsedMs(start),
      deactivated: false,
    };
  } catch (err: unknown) {
    const message = errorMessage(err);
    const deactivated = await recordFailedCheckSafe(sourceId, message);
    logWarn("ingestion_source_failed", {
      sourceId,
      reason: message,
      durationMs: elapsedMs(start),
    });
    return {
      sourceId,
      status: "FAILED",
      reason: message,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
      deactivated,
    };
  }
}

/**
 * Runs automated ingestion for all sources currently due for a check.
 *
 * Bounded to {@link MAX_SOURCES_PER_RUN} sources per execution and processed
 * sequentially. Mirrors the maintenance source-health semantics:
 * - sources not yet due are skipped silently,
 * - due sources without a baseUrl are counted as skipped,
 * - one failing source does not stop the remaining sources.
 *
 * @returns Deterministic summary of the source ingestion run
 */
export async function runSourcesIngestion(): Promise<SourcesIngestionResult> {
  const result: SourcesIngestionResult = {
    checked: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    ...zeroAggregates(),
  };

  const activeSources = await db
    .select({
      id: sources.id,
      baseUrl: sources.baseUrl,
      lastSuccessfulCheck: sources.lastSuccessfulCheck,
      checkFrequencyMinutes: sources.checkFrequencyMinutes,
    })
    .from(sources)
    .where(
      and(
        eq(sources.isActive, true),
        inArray(sources.sourceType, SUPPORTED_ADAPTER_SOURCE_TYPES),
      ),
    )
    .orderBy(asc(sources.lastSuccessfulCheck), sql`consecutive_failures DESC`)
    .limit(MAX_SOURCES_PER_RUN);

  for (const source of activeSources) {
    let isDue = false;
    try {
      isDue = (await isSourceDueForCheck(source.id)) === true;
    } catch {
      result.failed += 1;
      continue;
    }

    if (!isDue) {
      continue;
    }

    if (!source.baseUrl) {
      result.skipped += 1;
      continue;
    }

    result.checked += 1;

    const run = await runSourceIngestion(source.id);
    result.jobsReceived += run.total;
    result.jobsCreated += run.created;
    result.jobsUpdated += run.updated;
    result.duplicates += run.duplicate;
    result.failedRecords += run.failed;
    if (run.deactivated) result.autoDeactivatedSources += 1;

    if (run.status === "SUCCEEDED") {
      result.succeeded += 1;
    } else if (run.status === "FAILED") {
      result.failed += 1;
    } else {
      result.skipped += 1;
    }
  }

  logInfo("ingestion_run_completed", {
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

  return result;
}