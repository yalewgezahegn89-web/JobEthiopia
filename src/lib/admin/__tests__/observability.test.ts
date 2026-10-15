import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  OBSERVABILITY_SCOPE_NOTE,
  PLANNING_THRESHOLDS,
  getObservabilitySummary,
} from "@/lib/admin/observability";
import {
  recordApiRequest,
  recordRateLimitRejection,
  resetOperationalMetrics,
} from "@/lib/observability/metrics";
import {
  registerPoolStatsProvider,
  resetDatabaseMetrics,
} from "@/lib/observability/dbMetrics";

beforeEach(() => {
  resetOperationalMetrics();
  resetDatabaseMetrics();
  registerPoolStatsProvider(() => null);
});

afterEach(() => {
  resetOperationalMetrics();
  resetDatabaseMetrics();
  registerPoolStatsProvider(() => null);
});

function seedRequests(count: number, status: number, durationMs: number): void {
  for (let i = 0; i < count; i += 1) {
    recordApiRequest({
      route: "/api/jobs",
      method: "GET",
      status,
      durationMs,
    });
  }
}

describe("PLANNING_THRESHOLDS", () => {
  it("matches the Phase 16 §11 planning thresholds", () => {
    expect(PLANNING_THRESHOLDS).toEqual({
      latencyWarnMs: 1_000,
      latencyCriticalMs: 2_000,
      serverErrorRateWarnPercent: 1,
      dbConnectionsWarnPercent: 60,
      dbConnectionsCriticalPercent: 80,
      ingestionFailureRateWarnPercent: 5,
      searchLatencyWarnMs: 2_000,
      rateLimitRejectionWarnPercent: 1,
    });
  });
});

describe("getObservabilitySummary", () => {
  it("returns every operational section plus the scope note", () => {
    const summary = getObservabilitySummary();

    expect(summary.scopeNote).toBe(OBSERVABILITY_SCOPE_NOTE);
    expect(summary.request).toBeDefined();
    expect(summary.database).toBeDefined();
    expect(summary.ingestion).toBeDefined();
    expect(summary.rateLimit).toBeDefined();
    expect(summary.cache).toBeDefined();
    expect(summary.internalFetch).toBeDefined();
    expect(summary.generatedAt).toBeGreaterThan(0);
  });

  it("reports unknown indicators before anything is measured", () => {
    const summary = getObservabilitySummary();
    expect(summary.indicators).toHaveLength(4);
    expect(summary.indicators.map((i) => i.state)).toEqual([
      "unknown",
      "unknown",
      "unknown",
      "ok",
    ]);
    for (const indicator of summary.indicators) {
      expect(indicator.threshold).not.toBe("");
    }
    expect(summary.indicators.map((i) => i.key)).toEqual([
      "request_p95",
      "server_error_rate",
      "db_connection_utilisation",
      "rate_limit_rejections",
    ]);
  });

  it("raises the latency indicator past the warn and critical thresholds", () => {
    seedRequests(20, 200, 900);
    expect(getObservabilitySummary().indicators[0].state).toBe("ok");

    resetOperationalMetrics();
    seedRequests(20, 200, 1_500);
    expect(getObservabilitySummary().indicators[0].state).toBe("warn");

    resetOperationalMetrics();
    seedRequests(20, 200, 3_000);
    expect(getObservabilitySummary().indicators[0].state).toBe("critical");
  });

  it("raises the server error indicator above one percent", () => {
    seedRequests(100, 200, 10);
    seedRequests(2, 500, 10);
    expect(getObservabilitySummary().indicators[1].state).toBe("warn");
    expect(getObservabilitySummary().indicators[1].value).toContain("%");
  });

  it("grades DB connection utilisation against the §11 bands", () => {
    const build = (max: number, total: number, idle: number) => {
      registerPoolStatsProvider(() => ({
        max,
        total,
        idle,
        waiting: 0,
        connectTimeoutMs: 1,
        idleTimeoutMs: 1,
      }));
      return getObservabilitySummary().indicators[2];
    };

    expect(build(10, 5, 5).state).toBe("ok");
    expect(build(10, 9, 2).state).toBe("warn");
    expect(build(10, 10, 1).state).toBe("critical");
  });

  it("treats an observed rate-limit rejection as unknown (no denominator)", () => {
    expect(getObservabilitySummary().indicators[3].state).toBe("ok");
    recordRateLimitRejection({ bucket: "login", route: "/login", at: 0 });
    const indicator = getObservabilitySummary().indicators[3];
    expect(indicator.state).toBe("unknown");
    expect(indicator.value).toContain("1 rejected");
  });

  it("labels measurements as instrumentation readings, not SLOs", () => {
    const summary = getObservabilitySummary();
    expect(summary.scopeNote).toContain("cold start");
    expect(summary.scopeNote).toContain("instrumentation readings");
  });

  it("never leaks credentials, identity data, SQL or hostnames", () => {
    seedRequests(3, 200, 12);
    recordRateLimitRejection({ bucket: "api", route: "/api/jobs", at: 0 });
    const raw = JSON.stringify(getObservabilitySummary());

    expect(raw).not.toContain("DATABASE_URL");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("postgres");
    expect(raw).not.toContain("localhost");
    expect(raw).not.toContain("SELECT");
    expect(raw).not.toContain("user-agent");
    expect(raw).not.toContain("request body");
  });
});
