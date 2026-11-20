import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/locale";
import { localizePath } from "@/lib/i18n/routing";
import {
  absoluteUrl,
  buildPageMetadata,
  languageAlternates,
  NOINDEX_METADATA,
  normalizeBaseUrl,
  PRIVATE_EXACT_PATHS,
  PRIVATE_PATH_PREFIXES,
  privateMetadata,
  privateRobotsDisallowPaths,
  toIsoDate,
} from "../metadata";

const BASE = "https://jobethiopia.et/";

describe("shared SEO metadata helpers", () => {
  it("normalizes trailing slashes in the configured base URL", () => {
    expect(normalizeBaseUrl(BASE)).toBe("https://jobethiopia.et");
  });

  it("builds absolute URLs without duplicate slashes", () => {
    expect(absoluteUrl("/jobs", BASE)).toBe("https://jobethiopia.et/jobs");
    expect(absoluteUrl("jobs", BASE)).toBe("https://jobethiopia.et/jobs");
  });

  it("converts known dates to ISO 8601 and rejects invalid values", () => {
    expect(toIsoDate("2026-02-10T00:00:00.000Z")).toBe(
      "2026-02-10T00:00:00.000Z",
    );
    expect(toIsoDate("not-a-date")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });

  it("builds locale alternates without x-default by default", () => {
    expect(languageAlternates("/jobs", { base: BASE })).toEqual({
      en: "https://jobethiopia.et/jobs",
      am: "https://jobethiopia.et/am/jobs",
      om: "https://jobethiopia.et/om/jobs",
    });
  });

  it("adds x-default only when fully localized content is declared", () => {
    expect(
      languageAlternates("/jobs", { base: BASE, includeXDefault: true }),
    ).toEqual({
      en: "https://jobethiopia.et/jobs",
      am: "https://jobethiopia.et/am/jobs",
      om: "https://jobethiopia.et/om/jobs",
      "x-default": "https://jobethiopia.et/jobs",
    });
  });
});

describe("buildPageMetadata", () => {
  it("self-references the localized canonical on translated pages", () => {
    const metadata = buildPageMetadata({
      path: "/contact",
      locale: "am",
      baseUrl: BASE,
      title: "እኛን ያነጋግሩ",
      description: "ጆብኢትዮጵያን በኢሜል ያነጋግሩ።",
      includeAlternates: true,
      includeXDefault: true,
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://jobethiopia.et/am/contact",
    );
    expect(metadata.alternates?.languages).toEqual({
      en: "https://jobethiopia.et/contact",
      am: "https://jobethiopia.et/am/contact",
      om: "https://jobethiopia.et/om/contact",
      "x-default": "https://jobethiopia.et/contact",
    });
    expect(metadata.openGraph).toMatchObject({
      url: "https://jobethiopia.et/am/contact",
      locale: "am-ET",
    });
  });

  it("pins untranslated detail content to one English canonical with no alternates", () => {
    const metadata = buildPageMetadata({
      path: "/jobs/job-1",
      locale: "am",
      canonicalLocale: "en",
      baseUrl: BASE,
      title: "Senior Accountant",
      description: "Job details on JobEthiopia.",
      openGraphType: "article",
    });

    expect(metadata.alternates).toEqual({
      canonical: "https://jobethiopia.et/jobs/job-1",
    });
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: "https://jobethiopia.et/jobs/job-1",
    });
  });

  it("keeps a canonical but omits social metadata for noindex pages", () => {
    const metadata = buildPageMetadata({
      path: "/organizations/org-1",
      baseUrl: BASE,
      title: "Inactive employer",
      description: "Not publicly listed.",
      robots: NOINDEX_METADATA,
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://jobethiopia.et/organizations/org-1",
    );
    expect(metadata.robots).toEqual(NOINDEX_METADATA);
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });
});

describe("privateRobotsDisallowPaths", () => {
  it("covers localized auth/private paths without blocking public listings", () => {
    const paths = privateRobotsDisallowPaths();

    expect(paths).toContain("/login");
    expect(paths).toContain("/am/login");
    expect(paths).toContain("/om/login");
    expect(paths).toContain("/admin/");
    expect(paths).toContain("/organization/");
    expect(paths).not.toContain("/organizations/");
  });
});

describe("private route policy", () => {
  it("emits noindex metadata for every registered private path", () => {
    for (const path of [...PRIVATE_EXACT_PATHS, ...PRIVATE_PATH_PREFIXES]) {
      expect(privateMetadata(path).robots).toEqual(NOINDEX_METADATA);
    }
  });

  it("disallows every registered private path in every locale", () => {
    const paths = privateRobotsDisallowPaths();

    for (const path of PRIVATE_EXACT_PATHS) {
      expect(paths).toContain(path);
      for (const locale of LOCALES) {
        expect(paths).toContain(localizePath(path, locale));
      }
    }

    for (const prefix of PRIVATE_PATH_PREFIXES) {
      expect(paths).toContain(`${prefix}/`);
      for (const locale of LOCALES) {
        expect(paths).toContain(`${localizePath(prefix, locale)}/`);
      }
    }
  });
});
