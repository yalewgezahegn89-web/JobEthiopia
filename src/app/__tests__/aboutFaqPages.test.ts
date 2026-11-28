import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockLocale: "en",
  mockGetCurrentLocale: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getCurrentLocale: () => mocks.mockGetCurrentLocale(),
}));

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.et",
}));

import AboutPage, {
  generateMetadata as aboutMetadata,
} from "@/app/about/page";
import FaqPage, { generateMetadata as faqMetadata } from "@/app/faq/page";

const pages = [
  {
    name: "about",
    Page: AboutPage,
    metadata: aboutMetadata,
    enHeading: "About JobEthiopia",
    amHeading: "ስለ JobEthiopia",
    omHeading: "Waa&#x27;ee JobEthiopia",
  },
  {
    name: "faq",
    Page: FaqPage,
    metadata: faqMetadata,
    enHeading: "Frequently asked questions",
    amHeading: "ተደጋግሞ የሚጠየቁ ጥያቄዎች",
    omHeading: "Gaaffiiwwan yeroo baay&#x27;ee gaafataman",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockLocale = "en";
  mocks.mockGetCurrentLocale.mockImplementation(() =>
    Promise.resolve(mocks.mockLocale),
  );
});

async function render(page: (typeof pages)[number], locale: string) {
  mocks.mockLocale = locale;
  return renderToStaticMarkup(await page.Page());
}

describe("public information pages", () => {
  it.each(pages)("renders $name in English", async (page) => {
    const html = await render(page, "en");
    expect(html).toContain(page.enHeading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it.each(pages)("renders $name fully in Amharic", async (page) => {
    const html = await render(page, "am");
    expect(html).toContain(page.amHeading);
    expect(html).not.toContain(page.enHeading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it.each(pages)("renders $name fully in Afaan Oromo", async (page) => {
    const html = await render(page, "om");
    expect(html).toContain(page.omHeading);
    expect(html).not.toContain(page.enHeading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it("explains that JobEthiopia is not the employer", async () => {
    const html = await render(pages[0], "en");
    expect(html).toContain("JobEthiopia is not the employer");
  });

  it("states that production SMS delivery is not implemented", async () => {
    const html = await render(pages[1], "en");
    expect(html).toContain("Production SMS delivery is not currently implemented");
  });

  it("does not render literal template placeholders in Afaan Oromo", async () => {
    for (const page of pages) {
      const html = await render(page, "om");
      expect(html).not.toContain("${");
      expect(html).not.toContain("LEGAL_OPERATOR");
    }
  });

  it("renders corrected Afaan Oromo About roles", async () => {
    const html = await render(pages[0], "om");
    expect(html).toContain("Warra qacaraa galii qacaraa gaafatu");
    expect(html).toContain("mirkannaa hojjettootaa fudhuun");
    expect(html).toContain("Hojjattoonni hayyama qaban");
    expect(html).not.toContain("Yeroo hojii barbaadan galtee gaafatu");
    expect(html).not.toContain("hayyama hojii fudhuun");
  });
});

describe("public information page metadata", () => {
  it.each(pages)("sets localized metadata and alternates for $name", async (page) => {
    mocks.mockLocale = "am";
    const metadata = await page.metadata();

    expect(metadata.title).toEqual({
      absolute: expect.stringContaining("JobEthiopia"),
    });
    expect(metadata.alternates?.canonical).toBe(
      `https://jobethiopia.et/am/${page.name}`,
    );
    expect(metadata.alternates?.languages).toEqual({
      en: `https://jobethiopia.et/${page.name}`,
      am: `https://jobethiopia.et/am/${page.name}`,
      om: `https://jobethiopia.et/om/${page.name}`,
      "x-default": `https://jobethiopia.et/${page.name}`,
    });
  });

  it("uses an unprefixed canonical for English", async () => {
    mocks.mockLocale = "en";
    const metadata = await aboutMetadata();
    expect(metadata.alternates?.canonical).toBe("https://jobethiopia.et/about");
    expect(metadata.description).toBeTruthy();
  });
});
