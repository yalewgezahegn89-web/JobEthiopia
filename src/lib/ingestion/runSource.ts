import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { ingestJobs } from "@/lib/ingestion/batch";
import { getAdapterForSource } from "@/lib/sources/adapters";
import {
  recordSuccessfulCheck,
  recordFailedCheck,
  isSourceDueForCheck,
} from "@/lib/sources/health";

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
}

export interface SourcesIngestionResult {
  checked: number;
  succeeded: number;
  failed: number;
  skipped: number;
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
): Promise<void> {
  try {
    await recordFailedCheck(sourceId, message);
  } catch {
    // Health recording must never fail an ingestion run.
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
    };
  }

  if (!source.isActive) {
    return {
      sourceId,
      status: "SKIPPED",
      reason: "Source is inactive",
      ...zeroCounts(),
      durationMs: elapsedMs(start),
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
    };
  }

  let fetch;
  try {
    fetch = await adapter.fetchJobs(sourceId);
  } catch (err: unknown) {
    const message = errorMessage(err);
    await recordFailedCheckSafe(sourceId, message);
    return {
      sourceId,
      status: "FAILED",
      reason: message,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
    };
  }

  if (!fetch.success) {
    await recordFailedCheckSafe(sourceId, fetch.error);
    return {
      sourceId,
      status: "FAILED",
      reason: fetch.error,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
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
    };
  }

  try {
    const result = await ingestJobs({ sourceId, jobs: fetch.jobs });
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
    };
  } catch (err: unknown) {
    const message = errorMessage(err);
    await recordFailedCheckSafe(sourceId, message);
    return {
      sourceId,
      status: "FAILED",
      reason: message,
      ...zeroCounts(),
      durationMs: elapsedMs(start),
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
  };

  const activeSources = await db
    .select({
      id: sources.id,
      baseUrl: sources.baseUrl,
      lastSuccessfulCheck: sources.lastSuccessfulCheck,
      checkFrequencyMinutes: sources.checkFrequencyMinutes,
    })
    .from(sources)
    .where(eq(sources.isActive, true))
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
    if (run.status === "SUCCEEDED") {
      result.succeeded += 1;
    } else if (run.status === "FAILED") {
      result.failed += 1;
    } else {
      result.skipped += 1;
    }
  }

  return result;
}