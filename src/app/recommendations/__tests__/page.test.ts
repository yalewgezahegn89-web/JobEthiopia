import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetRecommendations: vi.fn(),
  mockTrackMatchEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/matching/dal", () => ({
  getCandidateRecommendations: (...args: unknown[]) =>
    mocks.mockGetRecommendations(...args),
}));

vi.mock("@/components/recommendations/recommendation-card", () => ({
  RecommendationCard: ({ item }: { item: { job: { title: string } } }) =>
    createElement("article", { "data-testid": "recommendation-card" }, item.job.title),
}));

vi.mock("@/lib/analytics/matchingEvents", () => ({
  trackMatchEvent: (...args: unknown[]) => mocks.mockTrackMatchEvent(...args),
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/server")>();
  return { ...actual, getI18n: async () => dictionaries.en };
});

import RecommendationsPage from "@/app/recommendations/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

function recommendationItem(id: string, title: string) {
  return {
    job: {
      id,
      title,
      slug: id,
      organizationId: "org-1",
      categoryId: null,
      professionId: null,
      locationId: null,
      organizationName: "ACME Plc",
      locationName: null,
      categoryName: null,
      professionName: null,
      employmentType: null,
      salaryText: null,
      deadlineText: null,
      postedAt: null,
      deadline: null,
      verificationStatus: "VERIFIED",
      status: "PUBLISHED",
    },
    score: 0.82,
    factors: [
      { key: "freshness", weight: 0.05, score: 1, detail: { reason: "recent" } },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockGetRecommendations.mockResolvedValue([
    recommendationItem("job-1", "Accountant"),
  ]);
  mocks.mockTrackMatchEvent.mockResolvedValue(undefined);
});

describe("RecommendationsPage", () => {
  it("loads recommendations for the authenticated candidate", async () => {
    const element = await RecommendationsPage();
    expect(element).toBeTruthy();
    expect(mocks.mockGetRecommendations).toHaveBeenCalledWith(CANDIDATE.id);
  });

  it("fires the recommendations-viewed analytics event with the result count", async () => {
    await RecommendationsPage();
    expect(mocks.mockTrackMatchEvent).toHaveBeenCalledWith({
      event: "match_recommendations_viewed",
      metadata: { resultCount: 1 },
    });
  });

  it("fires analytics with zero results on load failure without crashing", async () => {
    mocks.mockGetRecommendations.mockRejectedValue(new Error("db down"));
    const element = await RecommendationsPage();
    expect(element).toBeTruthy();
    expect(mocks.mockTrackMatchEvent).toHaveBeenCalledWith({
      event: "match_recommendations_viewed",
      metadata: { resultCount: 0 },
    });
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(RecommendationsPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(RecommendationsPage()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("renders an empty state when there are no recommendations", async () => {
    mocks.mockGetRecommendations.mockResolvedValue([]);
    const element = await RecommendationsPage();
    expect(element).toBeTruthy();
  });

  it("renders a single H1 with the page title", async () => {
    const html = renderToStaticMarkup(await RecommendationsPage());
    expect(html).toContain("Recommended jobs");
    const h1Count = (html.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it("renders the recommendation cards", async () => {
    const html = renderToStaticMarkup(await RecommendationsPage());
    expect(html).toContain('data-testid="recommendation-card"');
    expect(html).toContain("Accountant");
  });

  it("renders a safe error state on load failure", async () => {
    mocks.mockGetRecommendations.mockRejectedValue(new Error("db down"));
    const element = await RecommendationsPage();
    expect(element).toBeTruthy();
  });
});