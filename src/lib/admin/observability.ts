/**
 * Staff-facing observability summary (Phase 16 Batch 2).
 *
 * Reads the in-process operational registries and shapes them for the admin
 * Observability page. Pure, synchronous and database-free: it never issues a
 * query, never reads a credential and never exposes hostnames, SQL, request
 * bodies, IPs, user agents or identity data.
 *
 * Scope (important): every counter here is process-local and starts at zero on
 * each cold start. These are instrumentation readings, NOT production SLO
 * measurements. The planning thresholds in §11 of the Phase 16 batch spec are
 * published alongside the numbers so staff can compare like for like; they are
 * deliberately not labelled as targets or achieved values.
 */
import {
  getCacheMetrics,
  getInternalFetchMetrics,
  getIngestionMetrics,
  getRateLimitMetrics,
  getRequestMetrics,
  type CacheSeriesSnapshot,
  type IngestionMetricsSnapshot,
  type InternalFetchMetricsSnapshot,
  type RateLimitMetricsSnapshot,
  type RequestMetricsSnapshot,
} from "@/lib/observability/metrics";
import {
  getDatabaseSnapshot,
  type DatabaseSnapshot,
} from "@/lib/observability/dbMetrics";

/** Phase 16 §11 planning thresholds (guidance, never measured values). */
export const PLANNING_THRESHOLDS = {
  latencyWarnMs: 1_000,
  latencyCriticalMs: 2_000,
  serverErrorRateWarnPercent: 1,
  dbConnectionsWarnPercent: 60,
  dbConnectionsCriticalPercent: 80,
  ingestionFailureRateWarnPercent: 5,
  searchLatencyWarnMs: 2_000,
  rateLimitRejectionWarnPercent: 1,
} as const;

export type IndicatorState = "ok" | "warn" | "critical" | "unknown";

export interface Indicator {
  key: string;
  label: string;
  value: string;
  state: IndicatorState;
  threshold: string;
}

export interface ObservabilitySummary {
  generatedAt: number;
  scopeNote: string;
  indicators: Indicator[];
  thresholds: typeof PLANNING_THRESHOLDS;
  request: RequestMetricsSnapshot;
  database: DatabaseSnapshot;
  ingestion: IngestionMetricsSnapshot;
  rateLimit: RateLimitMetricsSnapshot;
  cache: CacheSeriesSnapshot[];
  internalFetch: InternalFetchMetricsSnapshot;
}

export const OBSERVABILITY_SCOPE_NOTE =
  "Counters are process-local and reset on every cold start. " +
  "Values below are instrumentation readings, not production measurements.";

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 10000) / 100;
}

function latencyState(p95: number): IndicatorState {
  if (p95 > PLANNING_THRESHOLDS.latencyCriticalMs) return "critical";
  if (p95 > PLANNING_THRESHOLDS.latencyWarnMs) return "warn";
  return "ok";
}

function errorRateState(rate: number | null): IndicatorState {
  if (rate === null) return "unknown";
  return rate > PLANNING_THRESHOLDS.serverErrorRateWarnPercent ? "warn" : "ok";
}

function connectionState(utilisation: number | null): IndicatorState {
  if (utilisation === null) return "unknown";
  if (utilisation > PLANNING_THRESHOLDS.dbConnectionsCriticalPercent) {
    return "critical";
  }
  if (utilisation > PLANNING_THRESHOLDS.dbConnectionsWarnPercent) return "warn";
  return "ok";
}

/** Builds the staff-facing observability snapshot. Never throws. */
export function getObservabilitySummary(): ObservabilitySummary {
  try {
    const request = getRequestMetrics();
    const database = getDatabaseSnapshot();
    const ingestion = getIngestionMetrics();
    const rateLimit = getRateLimitMetrics();
    const cache = getCacheMetrics();
    const internalFetch = getInternalFetchMetrics();

    const errorRate = percent(request.serverErrors, request.total);
    const utilisation = database.pool?.utilisationPercent ?? null;

    const indicators: Indicator[] = [
      {
        key: "request_p95",
        label: "API p95 latency",
        value: request.total === 0 ? "no traffic yet" : `${request.p95Ms} ms`,
        state: request.total === 0 ? "unknown" : latencyState(request.p95Ms),
        threshold: `warn > ${PLANNING_THRESHOLDS.latencyWarnMs} ms, critical > ${PLANNING_THRESHOLDS.latencyCriticalMs} ms`,
      },
      {
        key: "server_error_rate",
        label: "Server error (5xx) rate",
        value:
          errorRate === null
            ? "no traffic yet"
            : `${errorRate.toFixed(2)} % of ${request.total} requests`,
        state: errorRate === null ? "unknown" : errorRateState(errorRate),
        threshold: `investigate > ${PLANNING_THRESHOLDS.serverErrorRateWarnPercent} %`,
      },
      {
        key: "db_connection_utilisation",
        label: "DB connection utilisation",
        value:
          utilisation === null
            ? "pool unavailable"
            : `${utilisation} % of ${database.pool?.max ?? 0} connections`,
        state: connectionState(utilisation),
        threshold: `investigate > ${PLANNING_THRESHOLDS.dbConnectionsWarnPercent} %, escalate > ${PLANNING_THRESHOLDS.dbConnectionsCriticalPercent} %`,
      },
      {
        key: "rate_limit_rejections",
        label: "Rate-limit rejections",
        value: `${rateLimit.rejections} rejected`,
        state: rateLimit.rejections === 0 ? "ok" : "unknown",
        threshold: `review config > ${PLANNING_THRESHOLDS.rateLimitRejectionWarnPercent} % of requests (denominator is not available in-process)`,
      },
    ];

    return {
      generatedAt: Date.now(),
      scopeNote: OBSERVABILITY_SCOPE_NOTE,
      indicators,
      thresholds: PLANNING_THRESHOLDS,
      request,
      database,
      ingestion,
      rateLimit,
      cache,
      internalFetch,
    };
  } catch {
    return {
      generatedAt: Date.now(),
      scopeNote: OBSERVABILITY_SCOPE_NOTE,
      indicators: [],
      thresholds: PLANNING_THRESHOLDS,
      request: {
        series: 0,
        overflow: false,
        startedAt: null,
        updatedAt: null,
        total: 0,
        statusClasses: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
        clientErrors: 0,
        serverErrors: 0,
        avgMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        routes: [],
      },
      database: getDatabaseSnapshot(),
      ingestion: { runs: 0, succeeded: 0, failed: 0, lastRun: null, history: [] },
      rateLimit: { rejections: 0, buckets: [] },
      cache: [],
      internalFetch: {
        calls: 0,
        failures: 0,
        totalMs: 0,
        avgMs: 0,
        maxMs: 0,
        slowestTarget: null,
        attributedRequests: 0,
        avgCallsPerRequest: null,
        maxCallsInOneRequest: 0,
        targets: [],
      },
    };
  }
}
