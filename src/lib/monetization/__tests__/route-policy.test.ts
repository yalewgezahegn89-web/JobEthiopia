import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AD_FREE_ROUTE_PATTERNS,
  MAX_AD_SLOTS_PER_PAGE,
  isAdFreeRoute,
  isPlacementEligible,
  getEligiblePlacements,
  matchesRoute,
} from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

const AD_FREE_SAMPLES = [
  "/admin",
  "/admin/users",
  "/api/jobs",
  "/applications",
  "/applications/123",
  "/cover-letter",
  "/cover-letter/create",
  "/cv",
  "/cv/edit",
  "/employer",
  "/employer/register",
  "/forgot-password",
  "/interview-prep",
  "/job-alerts",
  "/login",
  "/logout",
  "/notifications",
  "/organization",
  "/organization/jobs",
  "/phone",
  "/profile",
  "/recommendations",
  "/register",
  "/reset-password",
  "/saved-jobs",
  "/settings",
  "/verify-email",
];

const PUBLIC_SAMPLES = ["/", "/jobs", "/jobs/abc", "/careers", "/careers/guide"];

describe("ad-free route policy", () => {
  it("keeps an explicit, non-empty policy", () => {
    expect(AD_FREE_ROUTE_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of AD_FREE_ROUTE_PATTERNS) {
      expect(pattern.startsWith("/")).toBe(true);
    }
  });

  it.each(AD_FREE_SAMPLES)("marks %s as ad-free", (pathname) => {
    expect(isAdFreeRoute(pathname)).toBe(true);
  });

  it.each(PUBLIC_SAMPLES)("allows %s as advertising-eligible", (pathname) => {
    expect(isAdFreeRoute(pathname)).toBe(false);
  });
});

describe("route => placement inventory", () => {
  it("maps the home route to the home banner", () => {
    expect(getEligiblePlacements("/")).toEqual([
      expect.objectContaining({ id: "home-banner" }),
    ]);
  });

  it("maps /jobs to the list banner (the sidebar base also matches the path)", () => {
    const placements = getEligiblePlacements("/jobs");
    expect(placements).toHaveLength(2);
    expect(placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "jobs-list-top" }),
        expect.objectContaining({ id: "job-detail-sidebar" }),
      ]),
    );
  });

  it("maps a job detail to the sidebar only", () => {
    expect(getEligiblePlacements("/jobs/abc")).toEqual([
      expect.objectContaining({ id: "job-detail-sidebar" }),
    ]);
  });

  it("maps a career article to the article-bottom placement", () => {
    expect(getEligiblePlacements("/careers/abc")).toEqual([
      expect.objectContaining({ id: "career-article-bottom" }),
    ]);
  });

  it("never returns placements on ad-free routes", () => {
    for (const pathname of AD_FREE_SAMPLES) {
      expect(getEligiblePlacements(pathname)).toEqual([]);
    }
  });

  it("stays within the per-page slot cap on every eligible page", () => {
    for (const page of PUBLIC_SAMPLES) {
      expect(getEligiblePlacements(page).length).toBeLessThanOrEqual(
        MAX_AD_SLOTS_PER_PAGE,
      );
    }
  });
});

describe("isPlacementEligible route enforcement", () => {
  it("is true for an enabled public placement with monetization on", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("home-banner", "/")).toBe(true);
    expect(isPlacementEligible("jobs-list-top", "/jobs")).toBe(true);
    expect(isPlacementEligible("career-article-bottom", "/careers/x")).toBe(true);
  });

  it("is false on ad-free routes even when the placement would match", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("job-detail-sidebar", "/admin/jobs")).toBe(false);
    expect(isPlacementEligible("jobs-list-top", "/login/jobs")).toBe(false);
    expect(isPlacementEligible("home-banner", "/cv")).toBe(false);
  });

  it("is false when monetization is disabled", () => {
    delete process.env.MONETIZATION_ENABLED;
    expect(isPlacementEligible("home-banner", "/")).toBe(false);
  });

  it("matches bare and nested paths for /** patterns", () => {
    expect(matchesRoute("/jobs", "/jobs/**")).toBe(true);
    expect(matchesRoute("/jobs/abc", "/jobs/**")).toBe(true);
    expect(matchesRoute("/careers", "/careers/**")).toBe(true);
    expect(matchesRoute("/careers/guide", "/careers/**")).toBe(true);
    expect(matchesRoute("/", "/jobs/**")).toBe(false);
  });
});
