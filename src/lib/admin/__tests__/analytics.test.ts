import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  pools: {} as Record<string, unknown[][]>,
  counters: {} as Record<string, number>,
  auditFindFirst: vi.fn(),
  nextRows(key: string): unknown[][] {
    const pool = this.pools[key] ?? [];
    const index = this.counters[key] ?? 0;
    this.counters[key] = index + 1;
    return (pool[Math.min(index, pool.length - 1)] ?? []) as unknown[][];
  },
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      auditLog: {
        findFirst: (...args: unknown[]) => mocks.auditFindFirst(...args),
      },
    },
    select: (fields: Record<string, unknown>) => {
      const key = Object.keys(fields).join(",");
      const rows = mocks.nextRows(key);
      const built = {
        from: () => built,
        where: () => built,
        groupBy: () => built,
        orderBy: () => built,
        limit: () => built,
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(rows).then(onFulfilled, onRejected),
      };
      return built;
    },
  },
}));

import { getAnalyticsSummary } from "@/lib/admin/analytics";

function recentDay(offsetBack: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetBack);
  return date.toISOString().slice(0, 10);
}

const TODAY = recentDay(0);
const YESTERDAY = recentDay(1);
const DAY2 = recentDay(2);
const DAY3 = recentDay(3);
const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

afterEach(() => {
  vi.clearAllMocks();
  mocks.pools = {};
  mocks.counters = {};
});

describe("getAnalyticsSummary", () => {
  beforeEach(() => {
    mocks.pools = {
      count: [
        [{ count: 100 }], // job_viewed total
        [{ count: 40 }], // job_search total
        [{ count: 60 }], // job_list_viewed total
        [{ count: 120 }], // applications
        [{ count: 45 }], // saved jobs
        [{ count: 70 }], // alert deliveries
        [{ count: 25 }], // registrations
        [{ count: 10 }], // JOB_PUBLISHED
        [{ count: 3 }], // JOB_REJECTED
        [{ count: 2 }], // JOB_REVERIFIED
        [{ count: 200 }], // published jobs
        [{ count: 5 }], // pending review
        [{ count: 11 }], // active sessions
        [{ count: 9 }], // total sources
        [{ count: 2 }], // failing sources
      ],
      "day,count": [
        [{ day: TODAY, count: 10 }],
        [{ day: YESTERDAY, count: 4 }],
        [{ day: DAY2, count: 6 }],
        [{ day: TODAY, count: 12 }],
        [{ day: DAY3, count: 9 }],
        [{ day: TODAY, count: 7 }],
        [{ day: YESTERDAY, count: 3 }],
      ],
      "locale,count": [
        [
          { locale: "en", count: 90 },
          { locale: "am", count: 80 },
          { locale: "om", count: 30 },
        ],
      ],
      "jobId,views": [[{ jobId: JOB_ID, views: 50 }]],
      "id,title": [[{ id: JOB_ID, title: "Senior Engineer" }]],
    };
    mocks.auditFindFirst.mockResolvedValue({
      metadata: {
        total: 20,
        created: 12,
        updated: 5,
        failed: 1,
        durationMs: 300,
      },
      targetId: "source-1",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
  });

  it("aggregates discovery totals and daily series per event", async () => {
    const summary = await getAnalyticsSummary(
      new Date("2026-06-15T12:00:00.000Z"),
    );

    expect(summary.discovery.totals).toEqual({
      job_viewed: 100,
      job_search: 40,
      job_list_viewed: 60,
    });
    expect(summary.discovery.daily.job_viewed).toHaveLength(14);
    expect(
      summary.discovery.daily.job_viewed.find((row) => row.day === TODAY)?.count,
    ).toBe(10);
    expect(
      summary.discovery.daily.job_search.find(
        (row) => row.day === YESTERDAY,
      )?.count,
    ).toBe(4);
    expect(
      summary.discovery.daily.job_list_viewed.find(
        (row) => row.day === DAY2,
      )?.count,
    ).toBe(6);
  });

  it("reports locale breakdown and top viewed jobs with titles", async () => {
    const summary = await getAnalyticsSummary();

    expect(summary.discovery.byLocale).toEqual([
      { locale: "en", count: 90 },
      { locale: "am", count: 80 },
      { locale: "om", count: 30 },
    ]);
    expect(summary.discovery.topViewedJobs).toEqual([
      { jobId: JOB_ID, title: "Senior Engineer", views: 50 },
    ]);
  });

  it("aggregates engagement metrics from source tables", async () => {
    const summary = await getAnalyticsSummary();

    expect(summary.engagement.applications).toEqual({
      total: 120,
      daily: expect.any(Array) as unknown,
    });
    expect(summary.engagement.applications.daily).toHaveLength(14);
    expect(
      summary.engagement.applications.daily.find(
        (row) => row.day === TODAY,
      )?.count,
    ).toBe(12);
    expect(summary.engagement.savedJobs.total).toBe(45);
    expect(summary.engagement.alertDeliveries.total).toBe(70);
    expect(summary.engagement.registrations.total).toBe(25);
  });

  it("reports moderation and platform health", async () => {
    const summary = await getAnalyticsSummary();

    expect(summary.moderation).toEqual({
      jobPublished: 10,
      jobRejected: 3,
      jobReverified: 2,
    });
    expect(summary.platform.publishedJobs).toBe(200);
    expect(summary.platform.pendingReviewJobs).toBe(5);
    expect(summary.platform.activeSessions).toBe(11);
    expect(summary.platform.totalSources).toBe(9);
    expect(summary.platform.failingSources).toBe(2);
  });

  it("parses the latest ingestion run from the audit trail", async () => {
    const summary = await getAnalyticsSummary();

    expect(summary.platform.latestIngestion).toEqual({
      timestamp: "2026-06-01T00:00:00.000Z",
      sourceId: "source-1",
      total: 20,
      created: 12,
      updated: 5,
      failed: 1,
      durationMs: 300,
    });
  });

  it("returns zeroed structure when no data exists", async () => {
    mocks.pools = {};
    mocks.auditFindFirst.mockResolvedValue(null);

    const summary = await getAnalyticsSummary();

    expect(summary.discovery.totals).toEqual({
      job_viewed: 0,
      job_search: 0,
      job_list_viewed: 0,
    });
    expect(summary.discovery.daily.job_viewed).toHaveLength(14);
    expect(summary.discovery.daily.job_viewed.every((r) => r.count === 0)).toBe(
      true,
    );
    expect(summary.discovery.byLocale).toEqual([]);
    expect(summary.discovery.topViewedJobs).toEqual([]);
    expect(summary.engagement.applications.total).toBe(0);
    expect(summary.platform.latestIngestion).toBeNull();
  });
});