import { expireDueJobs } from "./expiration";
import { checkDueSources } from "./sourceHealth";
import { pruneAnalyticsEvents } from "@/lib/analytics/retention";
import { logWarn } from "@/lib/observability/logger";

export type MaintenanceResult = {
  expiredJobs: number;
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
  analyticsEventsPruned: number;
};

/**
 * Orchestrates all maintenance tasks.
 *
 * Runs:
 * 1. Job expiration (expire published jobs past their deadline)
 * 2. Source health checks (check due sources, record success/failure)
 * 3. Analytics retention (prune discovery events past the retention window)
 *
 * Retention is best-effort: a pruning failure is logged and never fails the
 * maintenance run, so an analytics housekeeping problem can never block
 * job expiration or source health checks.
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

  let analyticsEventsPruned = 0;
  try {
    analyticsEventsPruned = (await pruneAnalyticsEvents(now)).pruned;
  } catch (err) {
    logWarn("analytics_retention_failed", {
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
  }

  return {
    expiredJobs: expiration.expired,
    sourcesChecked: health.checked,
    sourcesSucceeded: health.succeeded,
    sourcesFailed: health.failed,
    sourcesSkipped: health.skipped,
    analyticsEventsPruned,
  };
}
