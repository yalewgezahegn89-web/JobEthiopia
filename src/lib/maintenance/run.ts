import { expireDueJobs } from "./expiration";
import { checkDueSources } from "./sourceHealth";

export type MaintenanceResult = {
  expiredJobs: number;
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
};

/**
 * Orchestrates all maintenance tasks.
 *
 * Runs:
 * 1. Job expiration (expire published jobs past their deadline)
 * 2. Source health checks (check due sources, record success/failure)
 *
 * Returns a deterministic, JSON-serializable summary.
 * Internal errors are caught and do not leak stack traces or details.
 *
 * @param now - Deterministic timestamp for the entire run
 * @returns Maintenance summary
 */
export async function runMaintenance(
  now: Date,
): Promise<MaintenanceResult> {
  const expiration = await expireDueJobs(now);
  const health = await checkDueSources(now);

  return {
    expiredJobs: expiration.expired,
    sourcesChecked: health.checked,
    sourcesSucceeded: health.succeeded,
    sourcesFailed: health.failed,
    sourcesSkipped: health.skipped,
  };
}
