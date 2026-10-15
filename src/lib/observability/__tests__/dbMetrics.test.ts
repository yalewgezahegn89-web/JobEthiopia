import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_RECENT_DB_PROBES,
  getDatabaseSnapshot,
  recordDbProbe,
  registerPoolStatsProvider,
  resetDatabaseMetrics,
} from "@/lib/observability/dbMetrics";

beforeEach(() => {
  resetDatabaseMetrics();
  registerPoolStatsProvider(() => null);
});

afterEach(() => {
  vi.useRealTimers();
  resetDatabaseMetrics();
  registerPoolStatsProvider(() => null);
});

describe("pool statistics", () => {
  it("is null when no provider is registered", () => {
    expect(getDatabaseSnapshot().pool).toBeNull();
  });

  it("is null when the provider returns nothing", () => {
    registerPoolStatsProvider(() => null);
    expect(getDatabaseSnapshot().pool).toBeNull();
  });

  it("is null when the provider throws", () => {
    registerPoolStatsProvider(() => {
      throw new Error("pool unavailable");
    });
    expect(getDatabaseSnapshot().pool).toBeNull();
  });

  it("derives active connections and utilisation from the provider", () => {
    registerPoolStatsProvider(() => ({
      max: 10,
      total: 7,
      idle: 3,
      waiting: 2,
      connectTimeoutMs: 10_000,
      idleTimeoutMs: 30_000,
    }));

    const pool = getDatabaseSnapshot().pool;
    expect(pool?.max).toBe(10);
    expect(pool?.active).toBe(4);
    expect(pool?.utilisationPercent).toBe(40);
    expect(pool?.waiting).toBe(2);
  });

  it("reports a null utilisation when the pool has no configured maximum", () => {
    registerPoolStatsProvider(() => ({
      max: 0,
      total: 0,
      idle: 0,
      waiting: 0,
      connectTimeoutMs: 0,
      idleTimeoutMs: 0,
    }));
    expect(getDatabaseSnapshot().pool?.utilisationPercent).toBeNull();
  });

  it("keeps the provider across a metrics reset", () => {
    registerPoolStatsProvider(() => ({
      max: 5,
      total: 5,
      idle: 5,
      waiting: 0,
      connectTimeoutMs: 1,
      idleTimeoutMs: 1,
    }));
    resetDatabaseMetrics();
    expect(getDatabaseSnapshot().pool?.max).toBe(5);
  });
});

describe("readiness probes", () => {
  it("starts unmeasured", () => {
    const probe = getDatabaseSnapshot().probe;
    expect(probe.checks).toBe(0);
    expect(probe.successRate).toBeNull();
    expect(probe.lastOk).toBeNull();
    expect(probe.recent).toHaveLength(0);
  });

  it("tracks outcomes, rate and latency", () => {
    recordDbProbe({ ok: true, durationMs: 12, at: 1_000 });
    recordDbProbe({ ok: false, durationMs: 48, at: 2_000 });
    recordDbProbe({ ok: true, durationMs: 6, at: 3_000 });

    const probe = getDatabaseSnapshot().probe;
    expect(probe.checks).toBe(3);
    expect(probe.failures).toBe(1);
    expect(probe.successRate).toBeCloseTo(0.667, 3);
    expect(probe.lastOk).toBe(true);
    expect(probe.lastDurationMs).toBe(6);
    expect(probe.maxDurationMs).toBe(48);
    expect(probe.avgDurationMs).toBe(Math.round((12 + 48 + 6) / 3));
    expect(probe.recent).toHaveLength(3);
  });

  it("sanitizes non-finite durations", () => {
    recordDbProbe({ ok: true, durationMs: Number.NaN });
    const probe = getDatabaseSnapshot().probe;
    expect(probe.lastDurationMs).toBe(0);
    expect(Number.isNaN(probe.avgDurationMs)).toBe(false);
  });

  it("bounds the recent probe history", () => {
    for (let i = 0; i < MAX_RECENT_DB_PROBES + 20; i += 1) {
      recordDbProbe({ ok: true, durationMs: i, at: i });
    }
    const probe = getDatabaseSnapshot().probe;
    expect(probe.checks).toBe(MAX_RECENT_DB_PROBES + 20);
    expect(probe.recent.length).toBeLessThanOrEqual(MAX_RECENT_DB_PROBES);
  });

  it("clears counters on reset", () => {
    recordDbProbe({ ok: false, durationMs: 5 });
    resetDatabaseMetrics();
    expect(getDatabaseSnapshot().probe.checks).toBe(0);
  });
});

describe("privacy of the database snapshot", () => {
  it("publishes counters only — never credentials, hosts or SQL", () => {
    registerPoolStatsProvider(() => ({
      max: 10,
      total: 2,
      idle: 2,
      waiting: 0,
      connectTimeoutMs: 10_000,
      idleTimeoutMs: 30_000,
    }));
    recordDbProbe({ ok: true, durationMs: 3 });

    const raw = JSON.stringify(getDatabaseSnapshot());

    expect(raw).not.toContain("connectionString");
    expect(raw).not.toContain("DATABASE_URL");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("postgres");
    expect(raw).not.toContain("localhost");
    expect(raw).not.toContain("SELECT");
    expect(raw).not.toContain("host");
  });
});
