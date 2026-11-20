import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.et/",
}));

vi.mock("@/lib/sitemap/publicSitemap", () => ({
  buildPublicSitemapUrls: async () => [
    {
      path: "/am",
      alternates: {
        languages: {
          en: "/",
          am: "/am",
          om: "/om",
          "x-default": "/",
        },
      },
    },
    {
      path: "/am/privacy",
      lastModified: "2026-11-19",
      alternates: {
        languages: {
          en: "/privacy",
          am: "/am/privacy",
          om: "/om/privacy",
          "x-default": "/privacy",
        },
      },
    },
    { path: "/jobs/job-1" },
  ],
}));

import sitemap from "@/app/sitemap";

describe("sitemap route", () => {
  it("resolves legal alternates to absolute URLs", async () => {
    const entries = await sitemap();
    const legal = entries.find((entry) => entry.url.endsWith("/am/privacy"));

    expect(legal).toBeDefined();
    expect(legal?.lastModified).toBe("2026-11-19");
    expect(legal?.alternates?.languages).toEqual({
      en: "https://jobethiopia.et/privacy",
      am: "https://jobethiopia.et/am/privacy",
      om: "https://jobethiopia.et/om/privacy",
      "x-default": "https://jobethiopia.et/privacy",
    });
  });

  it("resolves localized static alternates without duplicating the base slash", async () => {
    const entries = await sitemap();
    const home = entries.find((entry) => entry.url === "https://jobethiopia.et/am");

    expect(home?.alternates?.languages).toEqual({
      en: "https://jobethiopia.et/",
      am: "https://jobethiopia.et/am",
      om: "https://jobethiopia.et/om",
      "x-default": "https://jobethiopia.et/",
    });
  });

  it("does not attach alternates to untranslated detail URLs", async () => {
    const entries = await sitemap();
    const detail = entries.find((entry) => entry.url.endsWith("/jobs/job-1"));

    expect(detail?.url).toBe("https://jobethiopia.et/jobs/job-1");
    expect(detail?.alternates).toBeUndefined();
  });
});
