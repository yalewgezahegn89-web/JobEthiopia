import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { sources } from "../../db/schema/sources";
import type { SourceHealthStatus } from "./types";

/**
 * Records a successful source check.
 *
 * **Writes** to the sources table:
 * - Sets lastSuccessfulCheck to now
 * - Sets lastAttemptedCheck to now
 * - Clears lastError (sets to null)
 * - Resets consecutiveFailures to 0
 *
 * Does NOT modify checkFrequencyMinutes.
 *
 * @param sourceId - The ID of the source to update
 * @returns The updated health status, or null if the source does not exist
 * @throws Database errors propagate to the caller
 */
export async function recordSuccessfulCheck(
  sourceId: string,
): Promise<SourceHealthStatus | null> {
  const now = new Date();

  const [updated] = await db
    .update(sources)
    .set({
      lastSuccessfulCheck: now,
      lastAttemptedCheck: now,
      lastError: null,
      consecutiveFailures: 0,
    })
    .where(eq(sources.id, sourceId))
    .returning({
      id: sources.id,
      lastSuccessfulCheck: sources.lastSuccessfulCheck,
      lastAttemptedCheck: sources.lastAttemptedCheck,
      lastError: sources.lastError,
      checkFrequencyMinutes: sources.checkFrequencyMinutes,
      consecutiveFailures: sources.consecutiveFailures,
    });

  if (!updated) return null;

  return {
    sourceId: updated.id,
    lastSuccessfulCheck: updated.lastSuccessfulCheck,
    lastAttemptedCheck: updated.lastAttemptedCheck,
    lastError: updated.lastError,
    checkFrequencyMinutes: updated.checkFrequencyMinutes,
    consecutiveFailures: updated.consecutiveFailures,
  };
}

/**
 * Records a failed source check.
 *
 * **Writes** to the sources table:
 * - Sets lastAttemptedCheck to now
 * - Sets lastError to the supplied error message
 * - Increments consecutiveFailures by 1 (database-side)
 *
 * Does NOT modify lastSuccessfulCheck.
 * Does NOT modify checkFrequencyMinutes.
 *
 * @param sourceId - The ID of the source to update
 * @param errorMessage - The error message from the failed check
 * @returns The updated health status, or null if the source does not exist
 * @throws Database errors propagate to the caller
 */
export async function recordFailedCheck(
  sourceId: string,
  errorMessage: string,
): Promise<SourceHealthStatus | null> {
  const now = new Date();

  const [updated] = await db
    .update(sources)
    .set({
      lastAttemptedCheck: now,
      lastError: errorMessage,
      consecutiveFailures: sql`consecutive_failures + 1`,
    })
    .where(eq(sources.id, sourceId))
    .returning({
      id: sources.id,
      lastSuccessfulCheck: sources.lastSuccessfulCheck,
      lastAttemptedCheck: sources.lastAttemptedCheck,
      lastError: sources.lastError,
      checkFrequencyMinutes: sources.checkFrequencyMinutes,
      consecutiveFailures: sources.consecutiveFailures,
    });

  if (!updated) return null;

  return {
    sourceId: updated.id,
    lastSuccessfulCheck: updated.lastSuccessfulCheck,
    lastAttemptedCheck: updated.lastAttemptedCheck,
    lastError: updated.lastError,
    checkFrequencyMinutes: updated.checkFrequencyMinutes,
    consecutiveFailures: updated.consecutiveFailures,
  };
}

/**
 * Determines whether a source is due for a check.
 *
 * **Read-only** — does not modify the database.
 *
 * Semantics:
 * - Returns true when lastSuccessfulCheck is null (never checked successfully)
 * - Returns true when checkFrequencyMinutes is null (no frequency configured = always due)
 * - Returns true when the configured frequency has elapsed since lastSuccessfulCheck
 * - Returns false otherwise
 * - Returns null if the source does not exist
 *
 * @param sourceId - The ID of the source to check
 * @returns true if due, false if not due, null if source not found
 * @throws Database errors propagate to the caller
 */
export async function isSourceDueForCheck(
  sourceId: string,
): Promise<boolean | null> {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: {
      lastSuccessfulCheck: true,
      checkFrequencyMinutes: true,
    },
  });

  if (!source) return null;

  // Never checked successfully — always due
  if (!source.lastSuccessfulCheck) return true;

  // No frequency configured — always due
  if (source.checkFrequencyMinutes === null) return true;

  const elapsedMs = Date.now() - source.lastSuccessfulCheck.getTime();
  const frequencyMs = source.checkFrequencyMinutes * 60 * 1000;

  return elapsedMs >= frequencyMs;
}

/**
 * Reads the current health status of a source.
 *
 * **Read-only** — does not modify the database.
 *
 * @param sourceId - The ID of the source to read
 * @returns The source health status, or null if the source does not exist
 * @throws Database errors propagate to the caller
 */
export async function getSourceHealth(
  sourceId: string,
): Promise<SourceHealthStatus | null> {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: {
      id: true,
      lastSuccessfulCheck: true,
      lastAttemptedCheck: true,
      lastError: true,
      checkFrequencyMinutes: true,
      consecutiveFailures: true,
    },
  });

  if (!source) return null;

  return {
    sourceId: source.id,
    lastSuccessfulCheck: source.lastSuccessfulCheck,
    lastAttemptedCheck: source.lastAttemptedCheck,
    lastError: source.lastError,
    checkFrequencyMinutes: source.checkFrequencyMinutes,
    consecutiveFailures: source.consecutiveFailures,
  };
}
