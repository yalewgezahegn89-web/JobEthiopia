import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockGetSummary: vi.fn(),
  mockGetI18n: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/admin/analytics",
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/analytics", () => ({
  getAnalyticsSummary: (...args: unknown[]) => mocks.mockGetSummary(...args),
}));

vi.mock("@/lib/i18n/server", () => ({
  getI18n: (...args: unknown[]) => mocks.mockGetI18n(...args),
}));

import AdminAnalyticsPage from "@/app/admin/analytics/page";

const EMPTY_SUMMARY = {
  window: {
    id: "30d",
    totalDays: 30,
    dailyDays: 14,
    trendUnit: "day",
    dateTo: "2026-06-15T00:00:00.000Z",
  },
  discovery: {
    totals: { job_viewed: 0, job_search: 0, job_list_viewed: 0 },
    daily: {
      job_viewed: [],
      job_search: [],
      job_list_viewed: [],
    },
    byLocale: [],
    topViewedJobs: [],
    topAppliedJobs: [],
  },
  searchQuality: {
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
  },
  publicPages: { total: 0, topPaths: [] },
  engagement: {
    applications: { total: 0, daily: [] },
    savedJobs: { total: 0, daily: [] },
    alertDeliveries: { total: 0, daily: [] },
    registrations: { total: 0, daily: [] },
  },
  funnel: { total: 0, byStatus: [] },
  recommendations: {
    views: 0,
    feedbackTotal: 0,
    avgResults: 0,
    feedback: { relevant: 0, notRelevant: 0, hidden: 0 },
  },
  careerTools: { cvActions: 0, coverLetterActions: 0, toolPageViews: 0, byEvent: [] },
  notifications: { created: 0, read: 0, unread: 0, readRate: 0, byType: [] },
  employer: {
    totalOrganizations: 0,
    newOrganizations: 0,
    employerAccounts: 0,
    jobsCreated: 0,
    applicationsReceived: 0,
    applicationReviews: 0,
  },
  ingestion: { runs: 0, jobsIngested: 0, activeSources: 0 },
  trends: {
    pageViews: [],
    recommendationViews: [],
    feedback: [],
    adImpressions: [],
    adClicks: [],
  },
  moderation: { jobPublished: 0, jobRejected: 0, jobReverified: 0 },
  monetization: { impressions: 0, clicks: 0, ctr: 0, byPlacement: [] },
  platform: {
    publishedJobs: 0,
    pendingReviewJobs: 0,
    activeSessions: 0,
    totalSources: 0,
    failingSources: 0,
    latestIngestion: null,
  },
};

const T = {
  adminAnalytics: {
    title: "Analytics",
    subtitle: "Subtitle placeholder",
    discoveryTitle: "Job discovery",
    engagementTitle: "Candidate engagement",
    moderationTitle: "Moderation",
    platformTitle: "Platform health",
    lastDays: (n: number) => `Last ${n} days`,
    loadError: "Could not load analytics.",
    never: "Never",
    listViews: "Job list views",
    jobSearches: "Job searches",
    jobViews: "Job detail views",
    topViewedJobs: "Most viewed jobs",
    noDiscovery: "No data",
    views: "views",
    byLanguage: "By language",
    applications: "Applications",
    savedJobs: "Saved jobs",
    alertsDelivered: "Deliveries",
    registrations: "New candidates",
    published: "Published",
    rejected: "Rejected",
    reverified: "Re-verified",
    publishedJobs: "Published jobs",
    pendingReview: "Pending review",
    activeSessions: "Active sessions",
    totalSources: "Sources",
    failingSources: "Failing",
    latestIngestion: "Latest run",
    windowTitle: "Time window",
    last24Hours: "Last 24 hours",
    searchQualityTitle: "Search quality",
    searches: "Searches",
    zeroResultSearches: "Zero-result searches",
    zeroResultRate: "Zero-result rate",
    avgResults: "Avg. results per search",
    filterUsage: "Filters used",
    filterQuery: "Keyword",
    filterCategory: "Category",
    filterProfession: "Profession",
    filterLocation: "Location",
    filterEmploymentType: "Employment type",
    filterOrganization: "Organization",
    noSearchQuality: "No searches recorded in this window.",
    publicPagesTitle: "Public page views",
    topPages: "Most viewed pages",
    noPublicPages: "No page views recorded yet.",
    funnelTitle: "Application funnel",
    statusNote: "Status of applications created in this window.",
    statusSubmitted: "Submitted",
    statusReviewing: "Reviewing",
    statusShortlisted: "Shortlisted",
    statusRejected: "Rejected",
    statusWithdrawn: "Withdrawn",
    noFunnel: "No applications in this window.",
    topAppliedJobs: "Most applied jobs",
    applicationsUnit: "applications",
    noAppliedJobs: "No applications yet.",
    careerToolsTitle: "Career tools",
    cvActions: "CV actions",
    coverLetterActions: "Cover letter actions",
    toolPageViews: "Tool page views",
    noCareerTools: "No career tool activity in this window.",
    recommendationsTitle: "Recommendations",
    recViews: "Recommendation views",
    recAvgResults: "Avg. recommendations per view",
    feedbackTitle: "Match feedback",
    feedbackRelevant: "Relevant",
    feedbackNotRelevant: "Not relevant",
    feedbackHidden: "Hidden",
    noRecommendations: "No recommendation activity in this window.",
    notificationsTitle: "Notifications",
    notificationsCreated: "Created",
    notificationsRead: "Read",
    notificationsUnread: "Unread",
    notificationsReadRate: "Read rate",
    notificationsByType: "By type",
    noNotifications: "No notifications in this window.",
    ctr: "Click-through rate",
    adPlacementsTitle: "Ad performance by placement",
    noPlacements: "No ad activity in this window.",
    ingestionTitle: "Ingestion",
    ingestionRuns: "Runs",
    jobsIngested: "Jobs ingested",
    activeSources: "Active sources",
    noIngestion: "No ingestion runs in this window.",
    employerTitle: "Employer activity",
    employerAccounts: "Employer accounts",
    totalOrganizations: "Organizations",
    newOrganizations: "New organizations",
    jobsCreated: "Jobs created",
    applicationReviews: "Application reviews",
  },
  adminAds: {
    monetizationTitle: "Monetization",
    impressions: "Ad impressions",
    clicks: "Ad clicks",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({ ok: true });
  mocks.mockGetSummary.mockResolvedValue(EMPTY_SUMMARY);
  mocks.mockGetI18n.mockResolvedValue(T);
});

function renderPage(props?: Parameters<typeof AdminAnalyticsPage>[0]) {
  return AdminAnalyticsPage(props ?? {});
}

describe("AdminAnalyticsPage", () => {
  it("redirects unauthenticated staff to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("does not query analytics when access is denied", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(renderPage()).rejects.toThrow();
    expect(mocks.mockGetSummary).not.toHaveBeenCalled();
  });

  it("requests the selected window with the opt-in cache", async () => {
    await renderPage({ searchParams: Promise.resolve({ window: "7d" }) });
    expect(mocks.mockGetSummary).toHaveBeenCalledWith(undefined, {
      windowId: "7d",
      cache: true,
    });
  });

  it("falls back to the default window for unknown values", async () => {
    await renderPage({ searchParams: Promise.resolve({ window: "forever" }) });
    expect(mocks.mockGetSummary).toHaveBeenCalledWith(undefined, {
      windowId: "30d",
      cache: true,
    });
  });

  it("renders the analytics dashboard for staff", async () => {
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Analytics");
    expect(html).toContain("Job discovery");
    expect(mocks.mockGetSummary).toHaveBeenCalledTimes(1);
  });

  it("renders the time-window selector with the active window", async () => {
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Time window");
    expect(html).toContain("/admin/analytics?window=1d");
    expect(html).toContain("/admin/analytics?window=7d");
    expect(html).toContain("/admin/analytics?window=90d");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Last 30 days");
  });

  it("renders the extended Phase 15 sections", async () => {
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Search quality");
    expect(html).toContain("Public page views");
    expect(html).toContain("Application funnel");
    expect(html).toContain("Recommendations");
    expect(html).toContain("Career tools");
    expect(html).toContain("Notifications");
    expect(html).toContain("Employer activity");
    expect(html).toContain("Ingestion");
    expect(html).toContain("Ad performance by placement");
    expect(html).toContain("Click-through rate");
  });

  it("renders windowed search quality and funnel metrics", async () => {
    mocks.mockGetSummary.mockResolvedValue({
      ...EMPTY_SUMMARY,
      searchQuality: {
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
      },
      funnel: {
        total: 7,
        byStatus: [
          { status: "SUBMITTED", count: 3 },
          { status: "REVIEWING", count: 4 },
        ],
      },
    });
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("12.5%");
    expect(html).toContain("Reviewing");
    expect(html).toContain("Submitted");
  });

  it("labels the 24 hour window in hours, never in days", async () => {
    mocks.mockGetSummary.mockResolvedValue({
      ...EMPTY_SUMMARY,
      window: {
        id: "1d",
        totalDays: 1,
        dailyDays: 24,
        trendUnit: "hour",
        dateTo: "2026-06-15T00:00:00.000Z",
      },
    });
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Last 24 hours");
    expect(html).not.toContain("Last 24 days");
    expect(html).not.toContain("Last 1 days");
  });

  it("renders the monetization section with ad metrics", async () => {
    mocks.mockGetSummary.mockResolvedValue({
      ...EMPTY_SUMMARY,
      monetization: {
        impressions: 125,
        clicks: 9,
        ctr: 7.2,
        byPlacement: [{ placementId: "sidebar", impressions: 125, clicks: 9 }],
      },
    });
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Monetization");
    expect(html).toContain("Ad impressions");
    expect(html).toContain("125");
    expect(html).toContain("Ad clicks");
    expect(html).toContain("9");
    expect(html).toContain("7.2%");
    expect(html).toContain("sidebar");
  });

  it("renders an error state when the summary query fails", async () => {
    mocks.mockGetSummary.mockRejectedValue(new Error("db down"));
    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Could not load analytics.");
  });
});