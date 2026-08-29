import { and, eq, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import {
  isSourceDueForCheck,
  recordSuccessfulCheck,
  recordFailedCheck,
} from "@/lib/sources/health";

const MAX_SOURCES_PER_RUN = 100;

export type SourceHealthResult = {
  checked: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

/**
 * Performs health checks on due sources.
 *
 * Uses the existing source-health primitives:
 * - isSourceDueForCheck() to determine eligibility
 * - HTTP HEAD request to source.baseUrl (existing behavior)
 * - recordSuccessfulCheck() / recordFailedCheck() to record results
 *
 * Rules:
 * - Bounded to MAX_SOURCES_PER_RUN (100) sources per execution
 * - One failed source does NOT stop processing of other sources
 * - Sources with no baseUrl are skipped (counted as skipped)
 * - Processes sources sequentially to avoid overwhelming the system
 * - Idempotent: sources not due will be skipped on subsequent runs
 *
 * @param now - Current timestamp for the run (injected for testing)
 * @returns Deterministic summary of source health processing
 */
export async function checkDueSources(now: Date): Promise<SourceHealthResult> {
  const result: SourceHealthResult = {
    checked: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  const activeSources = await db
    .select({
      id: sources.id,
      name: sources.name,
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
      const dueResult = await isSourceDueForCheck(source.id);
      isDue = dueResult === true;
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

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(source.baseUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (response.ok) {
        await recordSuccessfulCheck(source.id);
        result.succeeded += 1;
      } else {
        await recordFailedCheck(source.id, `HTTP ${response.status}`);
        result.failed += 1;
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Connection failed";
      try {
        await recordFailedCheck(source.id, errorMessage);
      } catch {
        // If recording the failure itself fails, count as failed but continue
      }
      result.failed += 1;
    }
  }

  return result;
}
