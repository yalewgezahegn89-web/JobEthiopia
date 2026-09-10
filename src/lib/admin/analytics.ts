/**
 * Admin facade over the analytics summary queries, following the
 * src/lib/admin/* convention used by admin pages.
 */
import { getAnalyticsSummary } from "@/lib/analytics/summary";

export { getAnalyticsSummary };
export type { AnalyticsSummary, DailyCount } from "@/lib/analytics/summary";