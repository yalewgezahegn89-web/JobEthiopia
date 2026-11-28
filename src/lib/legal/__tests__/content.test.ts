import { describe, it, expect } from "vitest";
import {
  legalContent,
  getLegalContent,
  type LegalDocument,
} from "../content";
import { LOCALES } from "@/lib/i18n/locale";
import { LEGAL_OPERATOR } from "../operator";

const documents = ["privacy", "terms", "cookies"] as const;

function documentText(doc: LegalDocument): string {
  return [
    doc.metaTitle,
    doc.metaDescription,
    doc.heading,
    ...doc.intro,
    ...doc.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
      ...(section.links ?? []).flatMap((link) => [link.label, link.href]),
    ]),
  ].join("\n");
}

describe("legal content", () => {
  it("provides all three documents in all supported locales", () => {
    for (const locale of LOCALES) {
      const content = getLegalContent(locale);
      expect(content).toBe(legalContent[locale]);
      for (const name of documents) {
        expect(content[name].heading.length).toBeGreaterThan(0);
        expect(content[name].intro.length).toBeGreaterThan(0);
        expect(content[name].sections.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the same section structure across languages", () => {
    for (const name of documents) {
      const counts = LOCALES.map(
        (locale) => legalContent[locale][name].sections.length,
      );
      expect(new Set(counts).size).toBe(1);
      const headings = LOCALES.map((locale) =>
        legalContent[locale][name].sections.map((section) =>
          section.heading.split(".")[0],
        ),
      );
      expect(headings[1]).toEqual(headings[0]);
      expect(headings[2]).toEqual(headings[0]);
    }
  });

  it("contains no empty text and all links have a destination", () => {
    for (const locale of LOCALES) {
      for (const name of documents) {
        const doc = legalContent[locale][name];
        for (const value of [...doc.intro, doc.metaTitle, doc.metaDescription]) {
          expect(value.trim().length).toBeGreaterThan(0);
        }
        for (const section of doc.sections) {
          expect(section.paragraphs.every((p) => p.trim().length > 0)).toBe(true);
          for (const link of section.links ?? []) {
            expect(link.href.length).toBeGreaterThan(0);
            expect(link.label.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("uses the operator contact details consistently", () => {
    expect(LEGAL_OPERATOR.email).toBe("jobethiopiaet@gmail.com");
    expect(LEGAL_OPERATOR.name).toBe("Yalew Abera");
    expect(LEGAL_OPERATOR.effectiveDate).toBe("2026-11-19");

    const privacy = legalContent.en.privacy;
    const rights = privacy.sections.find((section) =>
      section.heading.includes("Your rights"),
    );
    expect(rights?.paragraphs.join(" ")).toContain(LEGAL_OPERATOR.email);
    expect(rights?.links?.some((link) => link.href.startsWith("mailto:"))).toBe(
      true,
    );

    const advertising = privacy.sections.find((section) =>
      section.heading.includes("Advertising"),
    );
    expect(advertising?.links?.map((link) => link.href)).toEqual([
      "https://adssettings.google.com/",
      "https://www.aboutads.info/choices/",
    ]);
  });

  it("does not leave English policy sentences on localized routes", () => {
    for (const locale of ["am", "om"] as const) {
      for (const name of documents) {
        const doc = legalContent[locale][name];
        expect(doc.intro.join(" ")).not.toContain("Effective date:");
      }
    }
  });

  it("uses operator values instead of literal placeholders in Afaan Oromo", () => {
    for (const name of documents) {
      const text = documentText(legalContent.om[name]);
      expect(text).not.toContain("${");
      expect(text).not.toContain("LEGAL_OPERATOR");
    }

    const privacy = documentText(legalContent.om.privacy);
    expect(privacy).toContain(LEGAL_OPERATOR.name);
    expect(privacy).toContain(LEGAL_OPERATOR.email);
  });

  it("describes application notifications and team additions accurately", () => {
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
          "Hojjataan dhaabaa durii jiru fi hojii irra jiru imeelii isaatiin gamaatti dabaluu danda'a",
        ],
        forbidden: ["warra qacaraa beeksisuuf", "afferte"],
      },
    } as const;

    for (const locale of LOCALES) {
      const text = documentText(legalContent[locale].privacy);
      for (const phrase of expectations[locale].required) {
        expect(text).toContain(phrase);
      }
      for (const phrase of expectations[locale].forbidden) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  it("discloses first-party ad measurement consistently in privacy and cookie policies", () => {
    const expectations = {
      en: {
        required: [
          "ad_impression",
          "ad_click",
          "when monetization is enabled",
          "does not enable personalized advertising, third-party ad cookies, or AdSense by itself",
        ],
        forbidden: ["These analytics are not used for advertising."],
      },
      am: {
        required: [
          "ad_impressionና ad_click",
          "ገቢ ማግኛ ባህሪ ሲነቃ",
          "ግላዊ ማስታወቂያን",
          "AdSenseን አያነቃም",
        ],
        forbidden: ["ይህ ትንታኔ ለማስታወቂያ ጥቅም ላይ አይውልም።"],
      },
      om: {
        required: [
          "ad_impression fi ad_click",
          "(monetization) darbii keessa jiru",
          "beeksannaa dhuugaa taasisee",
          "AdSense hin ka'u",
        ],
        forbidden: ["Xiinxalli kun beeksannaaaf hin fayyadamu."],
      },
    } as const;

    for (const locale of LOCALES) {
      for (const name of ["privacy", "cookies"] as const) {
        const text = documentText(legalContent[locale][name]);
        for (const phrase of expectations[locale].required) {
          expect(text).toContain(phrase);
        }
        for (const phrase of expectations[locale].forbidden) {
          expect(text).not.toContain(phrase);
        }
      }
    }
  });
});
