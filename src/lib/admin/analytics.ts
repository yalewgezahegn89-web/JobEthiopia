/**
 * Admin facade over the analytics summary queries, following the
 * src/lib/admin/* convention used by admin pages.
 */
import { getAnalyticsSummary, clearAnalyticsSummaryCache } from "@/lib/analytics/summary";

export { getAnalyticsSummary, clearAnalyticsSummaryCache };
export type {
  AnalyticsSummary,
  AnalyticsSummaryOptions,
  AdvertisingMetrics,
  ApplicationFunnel,
  CareerTools,
  DailyCount,
  EmployerMetrics,
  IngestionMetrics,
  NotificationMetrics,
  PathCount,
  PublicPages,
  RecommendationMetrics,
  SearchQuality,
} from "@/lib/analytics/summary";
