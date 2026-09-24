import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockEligible: vi.fn(),
  mockProvider: vi.fn(),
  mockRender: vi.fn(),
  mockTrack: vi.fn(),
  mockConsent: vi.fn(),
  mockPlacement: vi.fn(),
}));

vi.mock("@/lib/monetization/config", () => ({
  isPlacementEligible: (...args: unknown[]) => mocks.mockEligible(...args),
  getAdPlacement: (...args: unknown[]) => mocks.mockPlacement(...args),
  reserveClassForFormat: () => "min-h-[100px] sm:min-h-[90px]",
}));

vi.mock("@/lib/monetization/providers", () => ({
  getAdProvider: (...args: unknown[]) => mocks.mockProvider(...args),
}));

vi.mock("@/lib/monetization/consent", () => ({
  isAdRenderingPermitted: (...args: unknown[]) => mocks.mockConsent(...args),
}));

vi.mock("@/lib/analytics/adEvents", () => ({
  trackAdEvent: (...args: unknown[]) => mocks.mockTrack(...args),
}));

import AdSlot from "@/components/ads/ad-slot";
import { dictionaries } from "@/lib/i18n/dictionary";

const CONTENT = {
  href: "https://sponsor.example/offer",
  title: "Sponsored listing",
  body: "A brand partner.",
};

const PROPS = {
  placementId: "jobs-list-top" as const,
  pathname: "/jobs",
  t: dictionaries.en,
};

function renderAdSlot(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(AdSlot, { ...PROPS, ...overrides }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockEligible.mockReturnValue(true);
  mocks.mockRender.mockReturnValue(CONTENT);
  mocks.mockProvider.mockReturnValue({
    id: "test",
    tracking: false,
    render: mocks.mockRender,
  });
  mocks.mockConsent.mockReturnValue(true);
  mocks.mockTrack.mockResolvedValue(undefined);
  mocks.mockPlacement.mockReturnValue({ format: "horizontal", enabled: true });
});

describe("AdSlot", () => {
  it("renders nothing when the placement is not eligible", () => {
    mocks.mockEligible.mockReturnValue(false);

    const html = renderAdSlot();

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when no provider is configured", () => {
    mocks.mockProvider.mockReturnValue(null);

    const html = renderAdSlot();

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when the provider returns no content", () => {
    mocks.mockProvider.mockReturnValue({
      id: "test",
      tracking: false,
      render: () => null,
    });

    const html = renderAdSlot();

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when the consent gate blocks a tracking provider", () => {
    mocks.mockConsent.mockReturnValue(false);

    const html = renderAdSlot();

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when the provider content has no title", () => {
    mocks.mockRender.mockReturnValue({ href: "https://x.example" });

    const html = renderAdSlot();

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders the ad with a privacy-safe link, label, and records an impression", () => {
    const html = renderAdSlot({
      placementId: "job-detail-sidebar",
      pathname: "/jobs/abc",
    });

    expect(html).toContain(CONTENT.title);
    expect(html).toContain(CONTENT.body);
    expect(html).toContain('href="https://sponsor.example/offer"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    // React serializes the JSX prop as `referrerPolicy`; HTML attribute names
    // are case-insensitive, so compare lowercased to stay renderer-agnostic.
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
    expect(html).toContain('aria-label="Advertisement"');
    expect(html).toContain('data-ad-placement="job-detail-sidebar"');
    expect(html).toContain('data-ad-provider="test"');
    // Visible localized ad label, distinct from editorial content.
    expect(html).toContain("Advertisement");
    // Reserved height applied for CLS stability.
    expect(html).toContain("min-h-[100px]");

    expect(mocks.mockTrack).toHaveBeenCalledWith({
      event: "ad_impression",
      placementId: "job-detail-sidebar",
      locale: "en",
    });
  });

  it("resolves localized copy keys for first-party house ads", () => {
    mocks.mockRender.mockReturnValue({
      href: "/cv",
      titleKey: "cvTitle",
      bodyKey: "cvBody",
    });

    const html = renderAdSlot({ locale: "am", t: dictionaries.am });

    expect(html).toContain(dictionaries.am.ads.house.cvTitle);
    expect(html).toContain(dictionaries.am.ads.house.cvBody);
    expect(html).toContain('href="/cv"');
    expect(html).not.toContain("undefined");
  });

  it("renders the link without a body when the provider omits it", () => {
    mocks.mockRender.mockReturnValue({
      href: "https://x.example",
      title: "Only title",
    });

    const html = renderAdSlot();

    expect(html).not.toContain("undefined");
    expect(html).toContain("Only title");
  });

  it("passes the resolved locale to the provider and impression", () => {
    renderAdSlot({ locale: "am" });

    expect(mocks.mockRender).toHaveBeenCalledWith({
      placementId: "jobs-list-top",
      pathname: "/jobs",
      locale: "am",
    });
    expect(mocks.mockTrack).toHaveBeenCalledWith({
      event: "ad_impression",
      placementId: "jobs-list-top",
      locale: "am",
    });
  });

  it("falls back to English when no locale is provided", () => {
    renderAdSlot();

    expect(mocks.mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
    expect(mocks.mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });
});