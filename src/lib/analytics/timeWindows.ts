/**
 * Analytics time-window model (Phase 15).
 *
 * Every dashboard number is scoped to one explicit window so that totals,
 * trends, and labels cannot disagree. Windows are bounded on purpose:
 * - no unbounded historical scans,
 * - a bounded number of trend points (max 24),
 * - the 24-hour window trends hourly, larger windows trend daily.
 *
 * Windows are data, not code paths: `parseAnalyticsWindowId` turns arbitrary
 * request input (e.g. `?window=…`) into one of the supported ids and falls
 * back to the default, so a bad value can never widen a query.
 */

export const ANALYTICS_WINDOW_IDS = ["1d", "7d", "30d", "90d"] as const;

export type AnalyticsWindowId = (typeof ANALYTICS_WINDOW_IDS)[number];

export type AnalyticsTrendUnit = "hour" | "day";

export type AnalyticsWindow = {
  id: AnalyticsWindowId;
  /** Number of days covered by the total/windowed counts (1 = last 24h). */
  days: number;
  /** Number of points in the trend series (bounded). */
  trendPoints: number;
  trendUnit: AnalyticsTrendUnit;
};

export const ANALYTICS_WINDOWS: Record<AnalyticsWindowId, AnalyticsWindow> = {
  "1d": { id: "1d", days: 1, trendPoints: 24, trendUnit: "hour" },
  "7d": { id: "7d", days: 7, trendPoints: 7, trendUnit: "day" },
  "30d": { id: "30d", days: 30, trendPoints: 14, trendUnit: "day" },
  "90d": { id: "90d", days: 90, trendPoints: 14, trendUnit: "day" },
};

export const DEFAULT_ANALYTICS_WINDOW_ID: AnalyticsWindowId = "30d";

const MS_PER_DAY = 86_400_000;

export function isAnalyticsWindowId(value: unknown): value is AnalyticsWindowId {
  return (
    typeof value === "string" &&
    (ANALYTICS_WINDOW_IDS as readonly string[]).includes(value)
  );
}

/** Coerces request input into a supported window id (defaults to 30d). */
export function parseAnalyticsWindowId(value: unknown): AnalyticsWindowId {
  if (Array.isArray(value)) {
    return parseAnalyticsWindowId(value[0]);
  }
  return isAnalyticsWindowId(value) ? value : DEFAULT_ANALYTICS_WINDOW_ID;
}

export function getAnalyticsWindow(
  id: unknown = DEFAULT_ANALYTICS_WINDOW_ID,
): AnalyticsWindow {
  return ANALYTICS_WINDOWS[parseAnalyticsWindowId(id)];
}

/** Inclusive start timestamp (UTC) of the windowed counts. */
export function windowStart(window: AnalyticsWindow, now: Date): Date {
  return new Date(now.getTime() - window.days * MS_PER_DAY);
}
