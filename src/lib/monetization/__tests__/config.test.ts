import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AD_PLACEMENTS,
  isMonetizationEnabled,
  getAdPlacement,
  isAdPlacementId,
  matchesRoute,
  isPlacementEligible,
} from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AD_PLACEMENTS", () => {
  it("has unique, non-empty ids and enabled placements", () => {
    const ids = AD_PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const placement of AD_PLACEMENTS) {
      expect(placement.route.length).toBeGreaterThan(0);
      expect(placement.enabled).toBe(true);
      expect(["horizontal", "rectangle"]).toContain(placement.format);
    }
  });
});

describe("isMonetizationEnabled", () => {
  it("is disabled by default (opt-in)", () => {
    delete process.env.MONETIZATION_ENABLED;
    expect(isMonetizationEnabled()).toBe(false);
  });

  it("is enabled only when the env var is exactly 'true'", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isMonetizationEnabled()).toBe(true);
  });

  it("stays disabled for any other value", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "1");
    expect(isMonetizationEnabled()).toBe(false);
    vi.stubEnv("MONETIZATION_ENABLED", "false");
    expect(isMonetizationEnabled()).toBe(false);
  });
});

describe("getAdPlacement", () => {
  it("returns a placement by id", () => {
    expect(getAdPlacement("jobs-list-top")?.route).toBe("/jobs");
    expect(getAdPlacement("job-detail-sidebar")?.route).toBe("/jobs/**");
  });

  it("returns undefined for an unknown id", () => {
    expect(getAdPlacement("home-hero")).toBeUndefined();
  });
});

describe("isAdPlacementId", () => {
  it("accepts every configured placement id", () => {
    for (const placement of AD_PLACEMENTS) {
      expect(isAdPlacementId(placement.id)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    expect(isAdPlacementId("home-hero")).toBe(false);
    expect(isAdPlacementId("")).toBe(false);
    expect(isAdPlacementId(null)).toBe(false);
    expect(isAdPlacementId(42)).toBe(false);
  });
});

describe("matchesRoute", () => {
  it("matches exact paths", () => {
    expect(matchesRoute("/jobs", "/jobs")).toBe(true);
    expect(matchesRoute("/jobs/", "/jobs")).toBe(false);
  });

  it("matches the base and any nested segment for /** patterns", () => {
    expect(matchesRoute("/jobs", "/jobs/**")).toBe(true);
    expect(matchesRoute("/jobs/abc", "/jobs/**")).toBe(true);
    expect(matchesRoute("/jobs/a/b/c", "/jobs/**")).toBe(true);
  });

  it("rejects paths outside the pattern", () => {
    expect(matchesRoute("/", "/jobs/**")).toBe(false);
    expect(matchesRoute("/careers", "/jobs/**")).toBe(false);
    expect(matchesRoute("/jobs-x", "/jobs/**")).toBe(false);
  });
});

describe("isPlacementEligible", () => {
  it("is false when monetization is disabled even for a matching placement", () => {
    delete process.env.MONETIZATION_ENABLED;
    expect(isPlacementEligible("jobs-list-top", "/jobs")).toBe(false);
  });

  it("is true for a known, enabled placement on its route", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("jobs-list-top", "/jobs")).toBe(true);
    expect(isPlacementEligible("job-detail-sidebar", "/jobs/abc")).toBe(true);
  });

  it("is false for an unknown placement id", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("home-hero", "/")).toBe(false);
  });

  it("is false on a non-matching route", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("jobs-list-top", "/careers")).toBe(false);
    expect(isPlacementEligible("job-detail-sidebar", "/jobs")).toBe(true);
  });

  it("rejects prefixed locale paths (canonical paths are used by callers)", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(isPlacementEligible("jobs-list-top", "/am/jobs")).toBe(false);
  });
});