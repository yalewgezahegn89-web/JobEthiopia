import { describe, it, expect } from "vitest";

import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  toLocale,
  toLocaleFromCookie,
  localeToIntl,
  LOCALE_COOKIE_NAME,
  LOCALE_METADATA,
} from "../locale";
import { dictionaries } from "../dictionary";
import {
  resolveLocaleFromHeaderValue,
  LOCALE_HEADER,
  getDictionary,
} from "../server";
import {
  formatDate,
  formatDateLong,
  formatNumber,
  resolveLocale,
} from "../format";
import {
  localeFromPathname,
  isPrefixedPath,
  stripLocalePrefix,
  localizePath,
  detectPathLocale,
} from "../routing";

const TOP_LEVEL_KEYS = [
  "common",
  "nav",
  "language",
  "search",
  "home",
  "jobs",
  "searchJobs",
  "careers",
  "organizations",
  "categories",
  "professions",
  "locations",
  "apply",
  "savedJobs",
  "applications",
  "jobAlerts",
  "empty",
  "error",
  "notFound",
  "footer",
  "adminAnalytics",
  "adminAds",
  "ads",
  "cv",
  "recommendations",
  "notifications",
  "profile",
  "changePassword",
  "publicDetail",
  "employerAuth",
  "employerNav",
  "loading",
] as const;

describe("locale allowlist", () => {
  it("contains exactly en, am, and om", () => {
    expect(LOCALES).toEqual(["en", "am", "om"]);
  });

  it("has default locale of en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("recognizes valid locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("am")).toBe(true);
    expect(isLocale("om")).toBe(true);
  });

  it("rejects invalid locales", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("coerces valid values but falls back to the default", () => {
    expect(toLocale("en")).toBe("en");
    expect(toLocale("am")).toBe("am");
    expect(toLocale("om")).toBe("om");
    expect(toLocale("invalid")).toBe(DEFAULT_LOCALE);
  });
});

describe("locale resolution (server)", () => {
  it("resolves a plain locale header value", () => {
    expect(resolveLocaleFromHeaderValue("am")).toBe("am");
  });

  it("maps intl-range values and falls back to the default", () => {
    expect(resolveLocaleFromHeaderValue("om-ET;q=0.9,en;q=0.8")).toBe(
      DEFAULT_LOCALE,
    );
  });

  it("falls back for unsupported and missing values", () => {
    expect(resolveLocaleFromHeaderValue("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromHeaderValue(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("exposes the intl code per locale", () => {
    expect(localeToIntl("am")).toBe("am-ET");
    expect(localeToIntl("en")).toBe("en-US");
    expect(localeToIntl("om")).toBe("om-ET");
  });

  it("exposes the locale header name", () => {
    expect(LOCALE_HEADER).toBe("x-jobethiopia-locale");
  });

  it("looks up a locale dictionary directly", () => {
    expect(getDictionary("en")).toBe(dictionaries.en);
  });
});

describe("dictionary completeness", () => {
  it("has entries for every locale", () => {
    for (const locale of LOCALES) {
      expect(dictionaries[locale]).toBeDefined();
    }
  });

  it("keeps identical top-level keys across all locales", () => {
    for (const locale of LOCALES) {
      const dict = dictionaries[locale];
      for (const key of TOP_LEVEL_KEYS) {
        expect(dict).toHaveProperty(key);
      }
      const dictKeys = Object.keys(dict);
      expect(dictKeys.length).toBe(TOP_LEVEL_KEYS.length);
      expect(dictKeys).toEqual(expect.arrayContaining([...TOP_LEVEL_KEYS]));
    }
  });

  it("keeps common static string values non-empty in English", () => {
    expect(dictionaries.en.common.brand.length).toBeGreaterThan(0);
    expect(dictionaries.en.common.home.length).toBeGreaterThan(0);
    expect(dictionaries.en.nav.home.length).toBeGreaterThan(0);
    expect(dictionaries.en.home.heroTitle.length).toBeGreaterThan(0);
    expect(dictionaries.en.footer.footerNavLabel.length).toBeGreaterThan(0);
  });

  it("has exactly three locales", () => {
    expect(LOCALES.length).toBe(3);
  });
});

describe("english fallback", () => {
  it("keeps the brand name in English", () => {
    expect(dictionaries.en.common.brand).toBe("JobEthiopia");
  });

  it("keeps the home nav in English", () => {
    expect(dictionaries.en.nav.home).toBe("Home");
  });

  it("differs in Amharic", () => {
    expect(dictionaries.am.nav.home).not.toBe("Home");
  });
});

describe("format utilities", () => {
  it("formats a date containing the year for English", () => {
    expect(formatDate(new Date("2026-01-15"), "en")).toContain("2026");
  });

  it("formats dates using the long formatter", () => {
    expect(formatDateLong(new Date("2026-01-15"), "en")).toContain("2026");
  });

  it("groups numbers for English", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
  });

  it("normalizes locale values through resolveLocale", () => {
    expect(resolveLocale("am")).toBe("am");
    expect(resolveLocale("invalid")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
  });
});

describe("routing", () => {
  it.each([
    ["/am/jobs", "am"],
    ["/am", "am"],
    ["/om/organizations", "om"],
    ["/om", "om"],
  ])("extracts a locale from a prefixed pathname (%s)", (path, expected) => {
    expect(localeFromPathname(path)).toBe(expected);
  });

  it("returns null for an unprefixed pathname", () => {
    expect(localeFromPathname("/jobs")).toBeNull();
  });

  it("detects prefixed paths", () => {
    expect(isPrefixedPath("/am/jobs")).toBe(true);
    expect(isPrefixedPath("/jobs")).toBe(false);
  });

  it("strips the locale prefix", () => {
    expect(stripLocalePrefix("/am/jobs")).toBe("/jobs");
    expect(stripLocalePrefix("/om/organizations")).toBe("/organizations");
    expect(stripLocalePrefix("/am")).toBe("/");
    expect(stripLocalePrefix("/jobs")).toBe("/jobs");
  });

  it("localizes a path into the target locale", () => {
    expect(localizePath("/jobs", "am")).toBe("/am/jobs");
    expect(localizePath("/jobs", "om")).toBe("/om/jobs");
    expect(localizePath("/am/jobs", "en")).toBe("/jobs");
  });

  it("resolves a raw path value to a locale", () => {
    expect(detectPathLocale("am")).toBe("am");
    expect(detectPathLocale("om")).toBe("om");
  });
});

describe("cookie and metadata", () => {
  it("round-trips through the cookie helper", () => {
    expect(toLocaleFromCookie("am")).toBe("am");
    expect(toLocaleFromCookie(null)).toBe(DEFAULT_LOCALE);
    expect(toLocaleFromCookie(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("exposes locale metadata and the cookie name", () => {
    expect(LOCALE_COOKIE_NAME).toBe("jobethiopia_locale");
    expect(LOCALE_METADATA.en.intl).toBe("en-US");
    expect(LOCALE_METADATA.am.intl).toBe("am-ET");
    expect(LOCALE_METADATA.om.intl).toBe("om-ET");
  });
});
