import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getAdProvider,
  getRegisteredProviderIds,
  isRegisteredProvider,
  listRegisteredProviders,
} from "../providers";
import {
  getHouseAd,
  getHouseAdCount,
} from "../houseAds";
import type { AdSlotContext, AdPlacementId } from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

const PLACEMENT_IDS: readonly AdPlacementId[] = [
  "home-banner",
  "jobs-list-top",
  "job-detail-sidebar",
  "career-article-bottom",
];

function contextFor(
  placementId: AdPlacementId,
  pathname = "/",
): AdSlotContext {
  return { placementId, pathname, locale: "en" };
}

describe("provider registry", () => {
  it("returns null when no provider is selected", () => {
    delete process.env.AD_PROVIDER;
    expect(getAdProvider()).toBeNull();
  });

  it("returns null when an unknown provider is selected", () => {
    vi.stubEnv("AD_PROVIDER", "adsense");
    expect(getAdProvider()).toBeNull();
  });

  it("selects the registered first-party house provider", () => {
    vi.stubEnv("AD_PROVIDER", "house");
    expect(getAdProvider()?.id).toBe("house");
    expect(getAdProvider()?.tracking).toBe(false);
  });

  it("exposes a stable provider allowlist", () => {
    expect(getRegisteredProviderIds()).toEqual(["house"]);
    expect(isRegisteredProvider("house")).toBe(true);
    expect(isRegisteredProvider("adsense")).toBe(false);
    expect(listRegisteredProviders().every((p) => !p.tracking)).toBe(true);
  });
});

describe("house provider content (houseAds)", () => {
  it("yields deterministic, first-party content for every placement", () => {
    for (const placementId of PLACEMENT_IDS) {
      const ad = getHouseAd(contextFor(placementId));
      expect(ad).not.toBeNull();
      expect(ad?.href).toBeDefined();
      expect(ad?.titleKey ?? ad?.title).toBeTruthy();
      expect(ad?.bodyKey ?? ad?.body).toBeTruthy();
    }
  });

  it("is stable across requests for the same placement (no personalization)", () => {
    const a = getHouseAd({
      ...contextFor("home-banner"),
      pathname: "/jobs/xyz",
      locale: "am",
    });
    const b = getHouseAd({
      ...contextFor("home-banner"),
      pathname: "/careers/xyz",
      locale: "om",
    });
    expect(a).toEqual(b);
  });

  it("only promotes genuine JobEthiopia first-party features", () => {
    const hrefs = new Set(PLACEMENT_IDS.map((id) => getHouseAd(contextFor(id))?.href));
    for (const href of hrefs) {
      expect(href).toMatch(/^\/(cv|careers)$/);
    }
  });

  it("has a small, hand-curated inventory", () => {
    expect(getHouseAdCount()).toBeGreaterThan(0);
    expect(getHouseAdCount()).toBeLessThanOrEqual(3);
  });
});
