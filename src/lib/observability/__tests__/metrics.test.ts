import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_ROUTE_SERIES,
  ROUTE_SAMPLE_CAP,
  INGESTION_RUN_CAP,
  getCacheMetrics,
  getInternalFetchMetrics,
  getIngestionMetrics,
  getRateLimitMetrics,
  getRequestMetrics,
  normalizeRoutePath,
  percentile,
  recordApiRequest,
  recordCacheEvent,
  recordIngestionRun,
  recordInternalFetch,
  recordRateLimitRejection,
  resetOperationalMetrics,
  statusClassOf,
} from "@/lib/observability/metrics";

beforeEach(() => {
  resetOperationalMetrics();
});

afterEach(() => {
  vi.useRealTimers();
  resetOperationalMetrics();
});

describe("statusClassOf", () => {
  it("groups statuses into 2xx/3xx/4xx/5xx", () => {
    expect(statusClassOf(200)).toBe("2xx");
    expect(statusClassOf(204)).toBe("2xx");
    expect(statusClassOf(301)).toBe("3xx");
    expect(statusClassOf(404)).toBe("4xx");
    expect(statusClassOf(429)).toBe("4xx");
    expect(statusClassOf(500)).toBe("5xx");
    expect(statusClassOf(503)).toBe("5xx");
  });
});

describe("percentile", () => {
  it("uses nearest rank over an ascending sample", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([10], 99)).toBe(10);
  });

  it("returns 0 for an empty sample set instead of NaN", () => {
    expect(percentile([], 95)).toBe(0);
    expect(Number.isNaN(percentile([], 99))).toBe(false);
  });
});

describe("normalizeRoutePath", () => {
  it("strips locale prefixes", () => {
    expect(normalizeRoutePath("/am/jobs")).toBe("/jobs");
    expect(normalizeRoutePath("/om/categories/it")).toBe("/categories/:slug");
    expect(normalizeRoutePath("/en")).toBe("/");
  });

  it("collapses identifier-shaped segments", () => {
    expect(
      normalizeRoutePath(
        "/api/applications/11111111-1111-4111-8111-111111111111/resume",
      ),
    ).toBe("/api/applications/:id/resume");
    expect(normalizeRoutePath("/api/jobs/12345")).toBe("/api/jobs/:id");
    expect(normalizeRoutePath("/jobs/abcdefghijklmnop")).toBe(
      "/jobs/:slug",
    );
  });

  it("never keeps a query string (search terms are not a route key)", () => {
    expect(normalizeRoutePath("/api/jobs?q=secret+term&page=2")).toBe(
      "/api/jobs",
    );
  });

  it("caps depth and marks overflow", () => {
    expect(normalizeRoutePath("/a/b/c/d/e/f")).toBe("/a/b/c/d/*");
    expect(normalizeRoutePath("/a/b")).toBe("/a/b");
  });

  it("survives malformed input without throwing", () => {
    expect(normalizeRoutePath("")).toBe("/");
    expect(normalizeRoutePath("///")).toBe("/");
  });
});

describe("request metrics", () => {
  it("aggregates counts, status classes and latency per route", () => {
    recordApiRequest({ route: "/api/jobs", method: "GET", status: 200, durationMs: 100 });
    recordApiRequest({ route: "/api/jobs", method: "GET", status: 200, durationMs: 300 });
    recordApiRequest({ route: "/api/jobs", method: "GET", status: 500, durationMs: 900 });
    recordApiRequest({ route: "/api/jobs", method: "POST", status: 400, durationMs: 50 });

    const snapshot = getRequestMetrics();
    expect(snapshot.total).toBe(4);
    expect(snapshot.statusClasses).toEqual({ "2xx": 2, "3xx": 0, "4xx": 1, "5xx": 1 });
    expect(snapshot.clientErrors).toBe(1);
    expect(snapshot.serverErrors).toBe(1);
    expect(snapshot.series).toBe(2);

    const get = snapshot.routes.find((r) => r.method === "GET");
    expect(get?.count).toBe(3);
    expect(get?.maxMs).toBe(900);
    expect(get?.avgMs).toBe(Math.round((100 + 300 + 900) / 3));
    expect(snapshot.p95Ms).toBeGreaterThanOrEqual(snapshot.p50Ms);
  });

  it("bounds the number of route series and reports overflow", () => {
    for (let i = 0; i < MAX_ROUTE_SERIES + 25; i += 1) {
      recordApiRequest({
        route: `/api/flood-${i}`,
        method: "GET",
        status: 200,
        durationMs: 1,
      });
    }
    const snapshot = getRequestMetrics();
    expect(snapshot.overflow).toBe(true);
    expect(snapshot.series).toBeLessThanOrEqual(MAX_ROUTE_SERIES + 1);
    expect(snapshot.routes.some((r) => r.route === "other")).toBe(true);
  });

  it("retains only a bounded number of latency samples per route", () => {
    for (let i = 0; i < ROUTE_SAMPLE_CAP + 50; i += 1) {
      recordApiRequest({
        route: "/api/bounded",
        method: "GET",
        status: 200,
        durationMs: i,
      });
    }
    const series = getRequestMetrics().routes.find((r) => r.route === "/api/bounded");
    expect(series?.count).toBe(ROUTE_SAMPLE_CAP + 50);
    expect(series?.p50Ms).toBeLessThanOrEqual(ROUTE_SAMPLE_CAP + 49);
  });

  it("never records a non-finite duration as NaN", () => {
    recordApiRequest({
      route: "/api/weird",
      method: "GET",
      status: 200,
      durationMs: Number.NaN,
    });
    const series = getRequestMetrics().routes.find((r) => r.route === "/api/weird");
    expect(series?.avgMs).toBe(0);
    expect(Number.isNaN(series?.p95Ms)).toBe(false);
  });

  it("is cleared by reset", () => {
    recordApiRequest({ route: "/x", method: "GET", status: 200, durationMs: 5 });
    resetOperationalMetrics();
    expect(getRequestMetrics().total).toBe(0);
  });
});

describe("rate-limit metrics", () => {
  it("aggregates rejections by bucket, route and minute", () => {
    recordRateLimitRejection({ bucket: "login", route: "/login", at: 0 });
    recordRateLimitRejection({ bucket: "login", route: "/login", at: 1_000 });
    recordRateLimitRejection({ bucket: "api", route: "/api/jobs/123", at: 60_000 });

    const snapshot = getRateLimitMetrics();
    expect(snapshot.rejections).toBe(3);

    const login = snapshot.buckets.find((b) => b.bucket === "login");
    expect(login?.rejections).toBe(2);
    expect(login?.routes).toEqual([{ route: "/login", rejections: 2 }]);
    expect(login?.timeBuckets).toHaveLength(1);

    const api = snapshot.buckets.find((b) => b.bucket === "api");
    expect(api?.routes[0]?.route).toBe("/api/jobs/:id");
  });

  it("drops the oldest minute buckets past the retention cap", () => {
    for (let i = 0; i < 80; i += 1) {
      recordRateLimitRejection({
        bucket: "api",
        route: "/api/jobs",
        at: i * 60_000,
      });
    }
    const api = getRateLimitMetrics().buckets.find((b) => b.bucket === "api");
    expect(api?.rejections).toBe(80);
    expect((api?.timeBuckets.length ?? 0)).toBeLessThanOrEqual(60);
  });
});

describe("cache metrics", () => {
  it("tracks hits, misses, evictions and build cost", () => {
    recordCacheEvent({ name: "analytics_summary", outcome: "hit" });
    recordCacheEvent({ name: "analytics_summary", outcome: "hit" });
    recordCacheEvent({
      name: "analytics_summary",
      outcome: "miss",
      buildDurationMs: 100,
    });
    recordCacheEvent({
      name: "analytics_summary",
      outcome: "miss",
      buildDurationMs: 300,
    });
    recordCacheEvent({ name: "analytics_summary", outcome: "evict" });

    const [entry] = getCacheMetrics();
    expect(entry?.name).toBe("analytics_summary");
    expect(entry?.hits).toBe(2);
    expect(entry?.misses).toBe(2);
    expect(entry?.evictions).toBe(1);
    expect(entry?.hitRate).toBeCloseTo(0.5, 3);
    expect(entry?.builds).toBe(2);
    expect(entry?.avgBuildMs).toBe(200);
    expect(entry?.maxBuildMs).toBe(300);
    expect(entry?.lastBuildMs).toBe(300);
  });

  it("reports a null hit rate before any lookup", () => {
    recordCacheEvent({ name: "empty_cache", outcome: "evict" });
    const [entry] = getCacheMetrics();
    expect(entry?.hitRate).toBeNull();
  });
});

describe("internal HTTP metrics", () => {
  it("records duration, failures and per-request fan-out", () => {
    recordInternalFetch({
      target: "/api/jobs?page=2",
      durationMs: 120,
      ok: true,
      requestId: "req-1",
    });
    recordInternalFetch({
      target: "/api/categories",
      durationMs: 80,
      ok: false,
      requestId: "req-1",
    });

    const snapshot = getInternalFetchMetrics();
    expect(snapshot.calls).toBe(2);
    expect(snapshot.failures).toBe(1);
    expect(snapshot.totalMs).toBe(200);
    expect(snapshot.avgMs).toBe(100);
    expect(snapshot.attributedRequests).toBe(1);
    expect(snapshot.maxCallsInOneRequest).toBe(2);
    expect(snapshot.targets.find((t) => t.target === "/api/jobs")?.calls).toBe(1);
  });

  it("never stores the query string of an internal call", () => {
    recordInternalFetch({
      target: "/api/jobs?q=confidential-search-term",
      durationMs: 10,
      ok: true,
    });
    const snapshot = getInternalFetchMetrics();
    expect(snapshot.targets.map((t) => t.target).join(" ")).not.toContain(
      "confidential-search-term",
    );
    expect(snapshot.targets[0]?.target).toBe("/api/jobs");
  });
});

describe("ingestion metrics", () => {
  it("keeps a bounded ring of runs with derived totals", () => {
    recordIngestionRun({
      at: 1_000,
      status: "SUCCEEDED",
      durationMs: 500,
      sourcesAttempted: 3,
      sourcesSucceeded: 3,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      jobsReceived: 90,
      jobsCreated: 12,
      jobsUpdated: 4,
      duplicates: 30,
      failedRecords: 1,
      autoDeactivatedSources: 0,
    });
    recordIngestionRun({
      at: 2_000,
      status: "FAILED",
      durationMs: 100,
      sourcesAttempted: 1,
      sourcesSucceeded: 0,
      sourcesFailed: 1,
      sourcesSkipped: 0,
      jobsReceived: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      duplicates: 0,
      failedRecords: 0,
      autoDeactivatedSources: 1,
    });

    const snapshot = getIngestionMetrics();
    expect(snapshot.runs).toBe(2);
    expect(snapshot.succeeded).toBe(1);
    expect(snapshot.failed).toBe(1);
    expect(snapshot.lastRun?.status).toBe("FAILED");
    expect(snapshot.history[0]?.at).toBe(2_000);
  });

  it("coerces missing counters and never stores an invalid status", () => {
    recordIngestionRun({
      at: 0,
      status: "NOT_A_STATUS" as never,
      durationMs: Number.NaN,
      sourcesAttempted: undefined as unknown as number,
      sourcesSucceeded: -5,
      sourcesFailed: 0,
      sourcesSkipped: 0,
      jobsReceived: undefined as unknown as number,
      jobsCreated: 0,
      jobsUpdated: 0,
      duplicates: 0,
      failedRecords: 0,
      autoDeactivatedSources: 0,
    });

    const [run] = getIngestionMetrics().history;
    expect(run?.status).toBe("SUCCEEDED");
    expect(run?.durationMs).toBe(0);
    expect(run?.sourcesAttempted).toBe(0);
    expect(run?.jobsReceived).toBe(0);
    expect(run?.sourcesSucceeded).toBe(0);
    expect(run?.at).toBeGreaterThan(0);
  });

  it("never retains more than the ring capacity", () => {
    for (let i = 0; i < INGESTION_RUN_CAP + 10; i += 1) {
      recordIngestionRun({
        at: i,
        status: "SUCCEEDED",
        durationMs: 1,
        sourcesAttempted: 0,
        sourcesSucceeded: 0,
        sourcesFailed: 0,
        sourcesSkipped: 0,
        jobsReceived: 0,
        jobsCreated: 0,
        jobsUpdated: 0,
        duplicates: 0,
        failedRecords: 0,
        autoDeactivatedSources: 0,
      });
    }
    expect(getIngestionMetrics().runs).toBe(INGESTION_RUN_CAP);
  });
});

describe("privacy of the registry", () => {
  it("exposes only route templates and normalized keys", () => {
    recordApiRequest({
      route: "/api/jobs/[id]",
      method: "GET",
      status: 200,
      durationMs: 10,
    });
    recordRateLimitRejection({
      bucket: "api",
      route: "/api/applications/11111111-1111-4111-8111-111111111111",
      at: 0,
    });
    recordInternalFetch({
      target: "/api/jobs?q=someone@example.com",
      durationMs: 5,
      ok: true,
    });

    const raw = JSON.stringify({
      request: getRequestMetrics(),
      rateLimit: getRateLimitMetrics(),
      cache: getCacheMetrics(),
      internalFetch: getInternalFetchMetrics(),
      ingestion: getIngestionMetrics(),
    });

    expect(raw).not.toContain("someone@example.com");
    expect(raw).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(raw).not.toContain("user-agent");
    expect(raw).not.toContain("password");
    expect(raw).toContain("/api/jobs/[id]");
  });
});
