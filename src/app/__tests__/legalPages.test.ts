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

import PrivacyPage, {
  generateMetadata as privacyMetadata,
} from "@/app/privacy/page";
import TermsPage, { generateMetadata as termsMetadata } from "@/app/terms/page";
import CookiesPage, {
  generateMetadata as cookiesMetadata,
} from "@/app/cookies/page";

const pages = [
  {
    name: "privacy",
    Page: PrivacyPage,
    metadata: privacyMetadata,
    enHeading: "Privacy Policy",
    amHeading: "የግላዊነት መመሪያ",
    omHeading: "Siyaasa Dhuugaa",
  },
  {
    name: "terms",
    Page: TermsPage,
    metadata: termsMetadata,
    enHeading: "Terms of Use",
    amHeading: "የአጠቃቀም ውሎች",
    omHeading: "Shartii Fayyadamaa",
  },
  {
    name: "cookies",
    Page: CookiesPage,
    metadata: cookiesMetadata,
    enHeading: "Cookie Policy",
    amHeading: "የኩኪ መመሪያ",
    omHeading: "Siyaasi Kaallii",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentLocale.mockImplementation(() =>
    Promise.resolve(mocks.mockLocale),
  );
});

async function render(page: (typeof pages)[number], locale: string) {
  mocks.mockLocale = locale;
  return renderToStaticMarkup(await page.Page());
}

describe("legal pages", () => {
  it.each(pages)("renders $name in English", async (page) => {
    const html = await render(page, "en");
    expect(html).toContain("<h1");
    expect(html).toContain(page.enHeading);
    expect(html).toContain("Effective date: November 19, 2026.");
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it.each(pages)("renders $name fully in Amharic", async (page) => {
    const html = await render(page, "am");
    expect(html).toContain(page.amHeading);
    expect(html).toContain("ኖቬምበር 19፣ 2026");
    expect(html).not.toContain("Effective date:");
    expect(html).not.toContain(page.enHeading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it.each(pages)("renders $name fully in Afaan Oromo", async (page) => {
    const html = await render(page, "om");
    expect(html).toContain(page.omHeading);
    expect(html).toContain("Sadaasa 19, 2026");
    expect(html).not.toContain("Effective date:");
    expect(html).not.toContain(page.enHeading);
    expect(html).toContain('href="mailto:jobethiopiaet@gmail.com"');
  });

  it("includes advertising disclosures and opt-out links in the privacy policy", async () => {
    const html = await render(pages[0], "en");
    expect(html).toContain("does not currently have Google AdSense");
    expect(html).toContain("no advertising cookies are currently used");
    expect(html).toContain('href="https://adssettings.google.com/"');
    expect(html).toContain('href="https://www.aboutads.info/choices/"');
    expect(html).toContain("365-day retention");
    expect(html).toContain("no self-service account deletion feature");
  });

  it("states that SMS delivery is not implemented", async () => {
    const html = await render(pages[0], "en");
    expect(html).toContain("Production SMS delivery is not currently implemented");
  });

  it("does not render literal template placeholders in Afaan Oromo", async () => {
    for (const page of pages) {
      const html = await render(page, "om");
      expect(html).not.toContain("${");
      expect(html).not.toContain("LEGAL_OPERATOR");
    }
  });

  it("renders accurate application notification and team addition disclosures", async () => {
    const expectations = {
      en: {
        required: [
          "used to send you a confirmation email",
          "The employer receives an in-app notification containing your name.",
          "An existing active organization administrator can be added by email.",
        ],
        forbidden: ["to notify the employer", "invite a team member"],
      },
      am: {
        required: [
          "የማረጋገጫ ኢሜይል ለመላክ ጥቅም ላይ ይውላሉ",
          "አሰሪው ስምዎን የያዘ በመተግበሪያው ውስጥ ያለ ማሳወቂያ ይቀበላል",
          "ነባርና ንቁ የሆነ የድርጅት አስተዳዳሪ በኢሜይል አድራሻ ሊጨመር ይችላል",
        ],
        forbidden: ["አሰሪውን ለማሳወቅም", "ከጋበዙ"],
      },
      om: {
        required: [
          "imeelii mirkaneessaa sii darbisuuf fayyadanna",
          "Warra qacaraa immoo maqaa kee qabu himannaa tajaajila keessa jiru ni argatu",
          "Hojjataan dhaabaa durii jiru fi hojii irra jiru imeelii isaatiin gamaatti dabaluu",
        ],
        forbidden: ["warra qacaraa beeksisuuf", "afferte"],
      },
    } as const;

    for (const locale of ["en", "am", "om"] as const) {
      const html = await render(pages[0], locale);
      for (const phrase of expectations[locale].required) {
        expect(html).toContain(phrase);
      }
      for (const phrase of expectations[locale].forbidden) {
        expect(html).not.toContain(phrase);
      }
    }
  });

  it("renders consistent first-party ad measurement disclosures", async () => {
    const forbiddenOldText = {
      en: "These analytics are not used for advertising.",
      am: "ይህ ትንታኔ ለማስታወቂያ ጥቅም ላይ አይውልም።",
      om: "Xiinxalli kun beeksannaaaf hin fayyadamu.",
    } as const;

    for (const locale of ["en", "am", "om"] as const) {
      for (const page of [pages[0], pages[2]]) {
        const html = await render(page, locale);
        expect(html).toContain("ad_impression");
        expect(html).toContain("ad_click");
        expect(html).not.toContain(forbiddenOldText[locale]);
      }
    }
  });
});

describe("legal page metadata", () => {
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
    const metadata = await privacyMetadata();
    expect(metadata.alternates?.canonical).toBe(
      "https://jobethiopia.et/privacy",
    );
    expect(metadata.description).toBeTruthy();
  });
});
