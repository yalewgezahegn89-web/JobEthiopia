import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { localizePath } from "@/lib/i18n/routing";

const state = vi.hoisted(() => ({
  locale: "en" as Locale,
}));

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.et/",
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/server")>();
  return {
    ...actual,
    getCurrentLocale: async () => state.locale,
    getI18n: async () => actual.getDictionary(state.locale),
  };
});

import { generateMetadata as homeMetadata } from "../page";
import { generateMetadata as jobsMetadata } from "../jobs/page";
import { generateMetadata as organizationsMetadata } from "../organizations/page";
import { generateMetadata as categoriesMetadata } from "../categories/page";
import { generateMetadata as professionsMetadata } from "../professions/page";
import { generateMetadata as locationsMetadata } from "../locations/page";
import { generateMetadata as careersMetadata } from "../careers/page";
import { generateMetadata as contactMetadata } from "../contact/page";

const PAGES = [
  ["home", "/", homeMetadata, "Find Jobs in Ethiopia"],
  ["jobs", "/jobs", jobsMetadata, "Jobs"],
  ["organizations", "/organizations", organizationsMetadata, "Organizations"],
  ["categories", "/categories", categoriesMetadata, "Categories"],
  ["professions", "/professions", professionsMetadata, "Professions"],
  ["locations", "/locations", locationsMetadata, "Locations"],
  ["careers", "/careers", careersMetadata, "Career Resources"],
  ["contact", "/contact", contactMetadata, "Contact"],
] as const;

describe("static public page metadata", () => {
  beforeEach(() => {
    state.locale = "en";
  });

  it.each(PAGES)(
    "%s emits a self-referencing canonical and full hreflang cluster in every locale",
    async (_name, path, generate, enTitle) => {
      for (const locale of LOCALES) {
        state.locale = locale;
        const metadata = await generate();

        expect(metadata.alternates?.canonical).toBe(
          `https://jobethiopia.et${localizePath(path, locale)}`,
        );
        expect(metadata.alternates?.languages).toEqual({
          en: `https://jobethiopia.et${localizePath(path, "en")}`,
          am: `https://jobethiopia.et${localizePath(path, "am")}`,
          om: `https://jobethiopia.et${localizePath(path, "om")}`,
          "x-default": `https://jobethiopia.et${localizePath(path, "en")}`,
        });
        expect(metadata.openGraph).toMatchObject({
          url: `https://jobethiopia.et${localizePath(path, locale)}`,
        });
        if (locale === "en") {
          expect(metadata.title).toBe(enTitle);
        }
      }
    },
  );

  it("uses translated titles and descriptions for localized list pages", async () => {
    state.locale = "am";
    const jobs = await jobsMetadata();
    const careers = await careersMetadata();

    expect(jobs.title).toBe("ስራዎች");
    expect(jobs.description).toContain("የተረጋገጡ");
    expect(careers.title).toBe("የሙያ ገጾች");
    expect(careers.description).toContain("የሙያ");
  });
});
