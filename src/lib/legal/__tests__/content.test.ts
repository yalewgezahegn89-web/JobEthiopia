import { describe, it, expect } from "vitest";
import { legalContent, getLegalContent } from "../content";
import { LOCALES } from "@/lib/i18n/locale";
import { LEGAL_OPERATOR } from "../operator";

const documents = ["privacy", "terms", "cookies"] as const;

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
});
