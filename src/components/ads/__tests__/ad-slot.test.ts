import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockEligible: vi.fn(),
  mockProvider: vi.fn(),
  mockRender: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock("@/lib/monetization/config", () => ({
  isPlacementEligible: (...args: unknown[]) => mocks.mockEligible(...args),
}));

vi.mock("@/lib/monetization/providers", () => ({
  getAdProvider: (...args: unknown[]) => mocks.mockProvider(...args),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockEligible.mockReturnValue(true);
  mocks.mockRender.mockReturnValue(CONTENT);
  mocks.mockProvider.mockReturnValue({ id: "test", render: mocks.mockRender });
  mocks.mockTrack.mockResolvedValue(undefined);
});

describe("AdSlot", () => {
  it("renders nothing when the placement is not eligible", () => {
    mocks.mockEligible.mockReturnValue(false);

    const html = renderToStaticMarkup(
      createElement(AdSlot, PROPS),
    );

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when no provider is configured", () => {
    mocks.mockProvider.mockReturnValue(null);

    const html = renderToStaticMarkup(createElement(AdSlot, PROPS));

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders nothing when the provider returns no content", () => {
    mocks.mockProvider.mockReturnValue({ id: "test", render: () => null });

    const html = renderToStaticMarkup(createElement(AdSlot, PROPS));

    expect(html).toBe("");
    expect(mocks.mockTrack).not.toHaveBeenCalled();
  });

  it("renders the ad with a privacy-safe link and records an impression", () => {
    const html = renderToStaticMarkup(
      createElement(AdSlot, {
        ...PROPS,
        placementId: "job-detail-sidebar",
        pathname: "/jobs/abc",
      }),
    );

    expect(html).toContain(CONTENT.title);
    expect(html).toContain(CONTENT.body);
    expect(html).toContain('href="https://sponsor.example/offer"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('aria-label="Advertisement"');
    expect(html).toContain('data-ad-placement="job-detail-sidebar"');

    expect(mocks.mockTrack).toHaveBeenCalledWith({
      event: "ad_impression",
      placementId: "job-detail-sidebar",
      locale: "en",
    });
  });

  it("passes the resolved locale to the provider and impression", () => {
    renderToStaticMarkup(createElement(AdSlot, { ...PROPS, locale: "am" }));

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
    renderToStaticMarkup(createElement(AdSlot, PROPS));

    expect(mocks.mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
    expect(mocks.mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });

  it("renders only the link without a body when the provider omits it", () => {
    mocks.mockRender.mockReturnValue({
      href: "https://x.example",
      title: "Only title",
    });

    const html = renderToStaticMarkup(createElement(AdSlot, PROPS));

    expect(html).not.toContain("undefined");
    expect(html).toContain("Only title");
  });
});