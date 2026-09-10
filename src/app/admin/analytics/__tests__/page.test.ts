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
  window: { totalDays: 30, dailyDays: 14, dateTo: "2026-06-15T00:00:00.000Z" },
  discovery: {
    totals: { job_viewed: 0, job_search: 0, job_list_viewed: 0 },
    daily: {
      job_viewed: [],
      job_search: [],
      job_list_viewed: [],
    },
    byLocale: [],
    topViewedJobs: [],
  },
  engagement: {
    applications: { total: 0, daily: [] },
    savedJobs: { total: 0, daily: [] },
    alertDeliveries: { total: 0, daily: [] },
    registrations: { total: 0, daily: [] },
  },
  moderation: { jobPublished: 0, jobRejected: 0, jobReverified: 0 },
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
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({ ok: true });
  mocks.mockGetSummary.mockResolvedValue(EMPTY_SUMMARY);
  mocks.mockGetI18n.mockResolvedValue(T);
});

describe("AdminAnalyticsPage", () => {
  it("redirects unauthenticated staff to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminAnalyticsPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminAnalyticsPage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("does not query analytics when access is denied", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminAnalyticsPage()).rejects.toThrow();
    expect(mocks.mockGetSummary).not.toHaveBeenCalled();
  });

  it("renders the analytics dashboard for staff", async () => {
    const html = renderToStaticMarkup(await AdminAnalyticsPage());
    expect(html).toContain("Analytics");
    expect(html).toContain("Job discovery");
    expect(mocks.mockGetSummary).toHaveBeenCalledTimes(1);
  });

  it("renders an error state when the summary query fails", async () => {
    mocks.mockGetSummary.mockRejectedValue(new Error("db down"));
    const html = renderToStaticMarkup(await AdminAnalyticsPage());
    expect(html).toContain("Could not load analytics.");
  });
});