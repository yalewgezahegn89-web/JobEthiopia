import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queues: {} as Record<string, unknown[][]>,
  counters: {} as Record<string, number>,
  selectCalls: 0,
  auditFindFirst: vi.fn(),
  rowsFor(key: string): unknown[] {
    mocks.selectCalls += 1;
    const queue = mocks.queues[key] ?? [];
    if (queue.length === 0) return [];
    const index = mocks.counters[key] ?? 0;
    mocks.counters[key] = index + 1;
    return queue[Math.min(index, queue.length - 1)];
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
      const rows = mocks.rowsFor(key);
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

import { clearAnalyticsSummaryCache, getAnalyticsSummary } from "../summary";

const SEARCH_KEY =
  "searches,zeroResults,totalResults,withQuery,withCategory,withProfession,withLocation,withEmploymentType,withOrganization";

function recentDay(offsetBack: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetBack);
  return date.toISOString().slice(0, 10);
}

const TODAY = recentDay(0);
const NOW = new Date("2026-06-15T12:00:00.000Z");

beforeEach(() => {
  mocks.queues = {};
  mocks.counters = {};
  mocks.selectCalls = 0;
  mocks.auditFindFirst.mockResolvedValue(null);
  clearAnalyticsSummaryCache();
});

describe("search quality", () => {
  it("derives zero-result rate, average results, and filter usage", async () => {
    mocks.queues[SEARCH_KEY] = [
      [
        {
          searches: 40,
          zeroResults: 5,
          totalResults: 248,
          withQuery: 30,
          withCategory: 12,
          withProfession: 4,
          withLocation: 8,
          withEmploymentType: 2,
          withOrganization: 1,
        },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.searchQuality).toEqual({
      searches: 40,
      zeroResultSearches: 5,
      zeroResultRate: 12.5,
      avgResults: 6.2,
      filters: {
        query: 30,
        category: 12,
        profession: 4,
        location: 8,
        employmentType: 2,
        organization: 1,
      },
    });
  });

  it("returns zeros when there were no searches", async () => {
    const summary = await getAnalyticsSummary(NOW);

    expect(summary.searchQuality).toEqual({
      searches: 0,
      zeroResultSearches: 0,
      zeroResultRate: 0,
      avgResults: 0,
      filters: {
        query: 0,
        category: 0,
        profession: 0,
        location: 0,
        employmentType: 0,
        organization: 0,
      },
    });
  });
});

describe("public pages and career tools", () => {
  it("aggregates page views and tool lifecycle events", async () => {
    mocks.queues["event,count"] = [
      [
        { event: "page_viewed", count: 12 },
        { event: "cv_created", count: 3 },
        { event: "cv_downloaded", count: 2 },
        { event: "cover_letter_created", count: 7 },
      ],
    ];
    mocks.queues["path,count"] = [
      [
        { path: "/", count: 6 },
        { path: "/cv", count: 4 },
        { path: "/careers/[id]", count: 2 },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.publicPages.total).toBe(12);
    expect(summary.publicPages.topPaths).toEqual([
      { path: "/", count: 6 },
      { path: "/cv", count: 4 },
      { path: "/careers/[id]", count: 2 },
    ]);
    expect(summary.careerTools.cvActions).toBe(5);
    expect(summary.careerTools.coverLetterActions).toBe(7);
    expect(summary.careerTools.toolPageViews).toBe(4);
    expect(summary.careerTools.byEvent).toEqual([
      { event: "cv_created", count: 3 },
      { event: "cv_downloaded", count: 2 },
      { event: "cover_letter_created", count: 7 },
    ]);
  });

  it("renders empty when nothing was recorded", async () => {
    const summary = await getAnalyticsSummary(NOW);

    expect(summary.publicPages).toEqual({ total: 0, topPaths: [] });
    expect(summary.careerTools).toEqual({
      cvActions: 0,
      coverLetterActions: 0,
      toolPageViews: 0,
      byEvent: [],
    });
  });
});

describe("application funnel", () => {
  it("reports every known status plus the jobs applications target", async () => {
    mocks.queues["status,count"] = [
      [
        { status: "SUBMITTED", count: 3 },
        { status: "REVIEWING", count: 4 },
      ],
    ];
    mocks.queues["jobId,applied"] = [
      [{ jobId: "550e8400-e29b-41d4-a716-446655440000", applied: 5 }],
    ];
    mocks.queues["id,title"] = [
      [{ id: "550e8400-e29b-41d4-a716-446655440000", title: "Nurse" }],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.funnel.total).toBe(7);
    expect(summary.funnel.byStatus).toEqual([
      { status: "SUBMITTED", count: 3 },
      { status: "REVIEWING", count: 4 },
      { status: "SHORTLISTED", count: 0 },
      { status: "REJECTED", count: 0 },
      { status: "WITHDRAWN", count: 0 },
    ]);
    expect(summary.discovery.topAppliedJobs).toEqual([
      {
        jobId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Nurse",
        applications: 5,
      },
    ]);
  });

  it("returns an empty funnel when there are no applications", async () => {
    const summary = await getAnalyticsSummary(NOW);

    expect(summary.funnel.total).toBe(0);
    expect(summary.funnel.byStatus).toHaveLength(5);
    expect(summary.discovery.topAppliedJobs).toEqual([]);
  });
});

describe("recommendations and feedback", () => {
  it("aggregates views, results per view, and feedback mix", async () => {
    mocks.queues["views,feedbackTotal,resultsTotal"] = [
      [{ views: 10, feedbackTotal: 6, resultsTotal: 120 }],
    ];
    mocks.queues["feedbackType,count"] = [
      [
        { feedbackType: "relevant", count: 4 },
        { feedbackType: "not_relevant", count: 2 },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.recommendations).toEqual({
      views: 10,
      feedbackTotal: 6,
      avgResults: 12,
      feedback: { relevant: 4, notRelevant: 2, hidden: 0 },
    });
  });

  it("avoids divide-by-zero when nothing was viewed", async () => {
    const summary = await getAnalyticsSummary(NOW);

    expect(summary.recommendations.avgResults).toBe(0);
    expect(summary.recommendations.feedback).toEqual({
      relevant: 0,
      notRelevant: 0,
      hidden: 0,
    });
  });
});

describe("notifications", () => {
  it("reports created, read, unread, and the top types", async () => {
    mocks.queues["created,read,unread"] = [
      [{ created: 20, read: 15, unread: 3 }],
    ];
    mocks.queues["type,count"] = [
      [
        { type: "job_alert_match", count: 9 },
        { type: "application_status_changed", count: 6 },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.notifications).toEqual({
      created: 20,
      read: 15,
      unread: 3,
      readRate: 75,
      byType: [
        { type: "job_alert_match", count: 9 },
        { type: "application_status_changed", count: 6 },
      ],
    });
  });
});

describe("employer and ingestion metrics", () => {
  it("combines gauges and windowed counts from source tables", async () => {
    mocks.queues["totalOrganizations"] = [[{ totalOrganizations: 12 }]];
    mocks.queues["newOrganizations"] = [[{ newOrganizations: 3 }]];
    mocks.queues["employerAccounts"] = [[{ employerAccounts: 18 }]];
    mocks.queues["jobsCreated"] = [[{ jobsCreated: 21 }]];
    mocks.queues["applicationReviews"] = [[{ applicationReviews: 9 }]];
    mocks.queues["activeSources"] = [[{ activeSources: 4 }]];
    mocks.queues["status,count"] = [
      [{ status: "SUBMITTED", count: 2 }],
    ];
    mocks.queues["runs,jobsIngested"] = [[{ runs: 6, jobsIngested: 120 }]];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.employer).toEqual({
      totalOrganizations: 12,
      newOrganizations: 3,
      employerAccounts: 18,
      jobsCreated: 21,
      applicationsReceived: 2,
      applicationReviews: 9,
    });
    expect(summary.ingestion).toEqual({
      runs: 6,
      jobsIngested: 120,
      activeSources: 4,
    });
  });
});

describe("advertising metrics", () => {
  it("derives CTR and groups impressions/clicks by placement", async () => {
    // Existing `count`-keyed queries run first: 17 of them, the last two are
    // monetization impressions and clicks.
    const countQueue: unknown[][] = [];
    for (let i = 0; i < 16; i += 1) countQueue.push([{ count: 100 }]);
    countQueue.push([{ count: 5 }]);
    mocks.queues["count"] = countQueue;
    mocks.queues["placementId,event,count"] = [
      [
        { placementId: "sidebar", event: "ad_impression", count: 100 },
        { placementId: "sidebar", event: "ad_click", count: 5 },
        { placementId: "inline", event: "ad_impression", count: 40 },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.monetization.impressions).toBe(100);
    expect(summary.monetization.clicks).toBe(5);
    expect(summary.monetization.ctr).toBe(5);
    expect(summary.monetization.byPlacement).toEqual([
      { placementId: "sidebar", impressions: 100, clicks: 5 },
      { placementId: "inline", impressions: 40, clicks: 0 },
    ]);
  });

  it("keeps CTR at zero when there were no impressions", async () => {
    const summary = await getAnalyticsSummary(NOW);

    expect(summary.monetization.ctr).toBe(0);
    expect(summary.monetization.byPlacement).toEqual([]);
  });
});

describe("trends", () => {
  it("fills the daily series from one grouped pass", async () => {
    mocks.queues["event,bucket,count"] = [
      [
        { event: "page_viewed", bucket: TODAY, count: 5 },
        { event: "ad_impression", bucket: TODAY, count: 9 },
      ],
    ];

    const summary = await getAnalyticsSummary(NOW);

    expect(summary.trends.pageViews).toHaveLength(14);
    expect(
      summary.trends.pageViews.find((row) => row.day === TODAY)?.count,
    ).toBe(5);
    expect(
      summary.trends.adImpressions.find((row) => row.day === TODAY)?.count,
    ).toBe(9);
    expect(
      summary.trends.recommendationViews.every((row) => row.count === 0),
    ).toBe(true);
  });
});

describe("time window selection", () => {
  it("scopes the summary to the 24 hour window with hourly trends", async () => {
    const summary = await getAnalyticsSummary(NOW, { windowId: "1d" });

    expect(summary.window).toEqual({
      id: "1d",
      totalDays: 1,
      dailyDays: 24,
      trendUnit: "hour",
      dateTo: NOW.toISOString(),
    });
    expect(summary.discovery.daily.job_viewed).toHaveLength(24);
    expect(summary.discovery.daily.job_viewed[0].day).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}$/,
    );
    expect(summary.engagement.applications.daily).toHaveLength(24);
  });

  it("scopes the summary to the 7 day window", async () => {
    const summary = await getAnalyticsSummary(NOW, { windowId: "7d" });

    expect(summary.window).toEqual({
      id: "7d",
      totalDays: 7,
      dailyDays: 7,
      trendUnit: "day",
      dateTo: NOW.toISOString(),
    });
    expect(summary.discovery.daily.job_viewed).toHaveLength(7);
    expect(summary.engagement.applications.daily).toHaveLength(7);
  });

  it("scopes the summary to the 90 day window without widening trends", async () => {
    const summary = await getAnalyticsSummary(NOW, { windowId: "90d" });

    expect(summary.window.totalDays).toBe(90);
    expect(summary.window.dailyDays).toBe(14);
    expect(summary.discovery.daily.job_viewed).toHaveLength(14);
  });

  it("falls back to the default window for unknown input", async () => {
    const summary = await getAnalyticsSummary(NOW, { windowId: "forever" });

    expect(summary.window.id).toBe("30d");
    expect(summary.window.totalDays).toBe(30);
    expect(summary.discovery.daily.job_viewed).toHaveLength(14);
  });
});

describe("summary cache", () => {
  it("serves repeat renders from cache when opted in", async () => {
    const first = await getAnalyticsSummary(NOW, { cache: true });
    const callsAfterFirst = mocks.selectCalls;

    const second = await getAnalyticsSummary(NOW, { cache: true });

    expect(mocks.selectCalls).toBe(callsAfterFirst);
    expect(second).toBe(first);
  });

  it("bypasses the cache by default", async () => {
    await getAnalyticsSummary(NOW);
    const callsAfterFirst = mocks.selectCalls;

    await getAnalyticsSummary(NOW);

    expect(mocks.selectCalls).toBeGreaterThan(callsAfterFirst);
  });

  it("keeps windows in separate cache entries", async () => {
    const day = await getAnalyticsSummary(NOW, { windowId: "1d", cache: true });
    const week = await getAnalyticsSummary(NOW, { windowId: "7d", cache: true });

    expect(day).not.toBe(week);
    expect(day.window.id).toBe("1d");
    expect(week.window.id).toBe("7d");
  });

  it("drops cached summaries on demand", async () => {
    await getAnalyticsSummary(NOW, { cache: true });
    const callsAfterFirst = mocks.selectCalls;

    clearAnalyticsSummaryCache();
    await getAnalyticsSummary(NOW, { cache: true });

    expect(mocks.selectCalls).toBeGreaterThan(callsAfterFirst);
  });
});
