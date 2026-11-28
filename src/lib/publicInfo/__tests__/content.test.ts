import { describe, it, expect } from "vitest";
import { LOCALES } from "@/lib/i18n/locale";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";
import {
  getPublicInformationContent,
  publicInformationContent,
  type PublicInformationDocument,
} from "../content";

const pages = ["about", "faq"] as const;

function documentText(doc: PublicInformationDocument): string {
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

describe("public information content", () => {
  it("provides both documents in all supported locales", () => {
    for (const locale of LOCALES) {
      const content = getPublicInformationContent(locale);
      expect(content).toBe(publicInformationContent[locale]);
      for (const name of pages) {
        expect(content[name].heading.length).toBeGreaterThan(0);
        expect(content[name].intro.length).toBeGreaterThan(0);
        expect(content[name].sections.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the same section structure across languages", () => {
    for (const name of pages) {
      const counts = LOCALES.map(
        (locale) => publicInformationContent[locale][name].sections.length,
      );
      expect(new Set(counts).size).toBe(1);
    }
  });

  it("contains no empty text and all links have a destination", () => {
    for (const locale of LOCALES) {
      for (const name of pages) {
        const doc = publicInformationContent[locale][name];
        for (const value of [...doc.intro, doc.metaTitle, doc.metaDescription]) {
          expect(value.trim().length).toBeGreaterThan(0);
        }
        for (const section of doc.sections) {
          expect(section.paragraphs.every((p) => p.trim().length > 0)).toBe(
            true,
          );
          for (const bullet of section.bullets ?? []) {
            expect(bullet.trim().length).toBeGreaterThan(0);
          }
          for (const link of section.links ?? []) {
            expect(link.href.length).toBeGreaterThan(0);
            expect(link.label.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("uses the operator contact address consistently", () => {
    for (const locale of LOCALES) {
      for (const name of pages) {
        expect(publicInformationContent[locale][name].sections.at(-1)?.links?.[0]?.href).toBe(
          `mailto:${LEGAL_OPERATOR.email}`,
        );
      }
    }
  });

  it("does not leave literal template placeholders in Afaan Oromo text", () => {
    for (const name of pages) {
      const text = documentText(publicInformationContent.om[name]);
      expect(text).not.toContain("${");
      expect(text).not.toContain("LEGAL_OPERATOR");
    }
  });

  it("describes employers and staff accurately in the Afaan Oromo About page", () => {
    const text = documentText(publicInformationContent.om.about);
    expect(text).toContain("Warra qacaraa galii qacaraa gaafatu");
    expect(text).toContain("mirkannaa hojjettootaa fudhuun");
    expect(text).toContain("Hojjattoonni hayyama qaban");
    expect(text).not.toContain("Yeroo hojii barbaadan galtee gaafatu");
    expect(text).not.toContain("hayyama hojii fudhuun");
  });
});
