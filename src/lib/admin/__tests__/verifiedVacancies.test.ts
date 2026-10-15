import { describe, it, expect } from "vitest";
import {
  VERIFIED_VACANCIES,
  VERIFIED_VACANCIES_HEADER,
  VERIFIED_VACANCY_ORGANIZATIONS,
  VERIFIED_VACANCY_SOURCES,
  vacancyToCuratedInput,
  type VerifiedVacancyIdMap,
} from "@/lib/admin/verifiedVacancies";
import { curatedCreateJobSchema } from "@/lib/validations/curatedJob";

const SEED_CATEGORY_SLUGS = [
  "healthcare",
  "operations-administration",
  "finance-economics",
  "transport-logistics",
];
const SEED_PROFESSION_SLUGS = [
  "nursing",
  "nutrition",
  "operations",
  "public-finance-economic-policy",
  "driver",
];
const SEED_LOCATION_SLUGS = [
  "ethiopia",
  "addis-ababa",
  "hawassa",
  "semera",
  "konso",
];

function idMap(): VerifiedVacancyIdMap {
  const orgs = Object.fromEntries(
    VERIFIED_VACANCY_ORGANIZATIONS.map((org, i) => [
      org.slug,
      `11111111-1111-4111-8111-00000000000${i + 1}`,
    ]),
  );
  const cats = Object.fromEntries(
    SEED_CATEGORY_SLUGS.map((s, i) => [
      s,
      `22222222-2222-4222-8222-00000000000${i + 1}`,
    ]),
  );
  const profs = Object.fromEntries(
    SEED_PROFESSION_SLUGS.map((s, i) => [
      s,
      `33333333-3333-4333-8333-00000000000${i + 1}`,
    ]),
  );
  const locs = Object.fromEntries(
    SEED_LOCATION_SLUGS.map((s, i) => [
      s,
      `44444444-4444-4444-8444-00000000000${i + 1}`,
    ]),
  );
  return { organizations: orgs, categories: cats, professions: profs, locations: locs };
}

describe("VERIFIED_VACANCIES — batch-level integrity", () => {
  it("is tagged as the real, verified Phase 6 Step 7 batch", () => {
    expect(VERIFIED_VACANCIES_HEADER).toEqual({
      scope: "phase-6-step-7",
      designation: "real-verified-vacancies",
      verified: true,
      published: false,
    });
  });

  it("contains exactly the four first verified vacancies", () => {
    expect(VERIFIED_VACANCIES).toHaveLength(4);
  });

  it("has unique external ids, titles and application urls", () => {
    const externalIds = VERIFIED_VACANCIES.map((v) => v.originalSource.externalId);
    const titles = VERIFIED_VACANCIES.map((v) => v.title);
    const urls = VERIFIED_VACANCIES.map((v) => v.applicationUrl);
    expect(new Set(externalIds).size).toBe(externalIds.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("references only organizations declared in the fixture", () => {
    const slugs = VERIFIED_VACANCY_ORGANIZATIONS.map((o) => o.slug);
    for (const v of VERIFIED_VACANCIES) {
      expect(slugs).toContain(v.organizationSlug);
    }
  });

  it("references taxonomy that Step 6 seeded and activated", () => {
    for (const v of VERIFIED_VACANCIES) {
      expect(SEED_CATEGORY_SLUGS).toContain(v.categorySlug);
      expect(SEED_LOCATION_SLUGS).toContain(v.locationSlug);
      if (v.professionSlug) {
        expect(SEED_PROFESSION_SLUGS).toContain(v.professionSlug);
      }
    }
  });

  it("uses only canonical source names and official-page origin urls", () => {
    for (const v of VERIFIED_VACANCIES) {
      const source = VERIFIED_VACANCY_SOURCES.find(
        (s) => s.sourceName === v.originalSource.sourceName,
      );
      expect(source).toBeDefined();
      expect(v.originalSource.sourceUrl.startsWith(source!.baseUrl)).toBe(true);
    }
  });

  it("has deadlines that are exact ISO instants in the future", () => {
    const now = Date.now();
    for (const v of VERIFIED_VACANCIES) {
      const t = new Date(v.deadline).getTime();
      expect(Number.isNaN(t)).toBe(false);
      expect(t).toBeGreaterThan(now);
    }
  });

  it("formats advertisedOn as YYYY-MM-DD when present", () => {
    for (const v of VERIFIED_VACANCIES) {
      if (v.advertisedOn) {
        expect(v.advertisedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("keeps every body field populated for curation", () => {
    for (const v of VERIFIED_VACANCIES) {
      expect(v.title.trim().length).toBeGreaterThan(0);
      expect(v.description.trim().length).toBeGreaterThan(20);
      expect(v.responsibilities.trim().length).toBeGreaterThan(20);
      expect(v.requirements.trim().length).toBeGreaterThan(20);
      expect(v.educationRequirements.trim().length).toBeGreaterThan(5);
      expect(v.experienceMin).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("vacancyToCuratedInput", () => {
  it("maps every record to a curated input that passes curatedCreateJobSchema", () => {
    for (const v of VERIFIED_VACANCIES) {
      const input = vacancyToCuratedInput(v, idMap());
      const parsed = curatedCreateJobSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (!parsed.success) {
        expect(parsed.error.issues.map((i) => i.path.join("."))).toEqual([]);
      }
    }
  });

  it("preserves the original source block for the dual-provenance flow", () => {
    const v = VERIFIED_VACANCIES[0];
    const input = vacancyToCuratedInput(v, idMap());
    expect(input.originalSource).toEqual({
      sourceName: v.originalSource.sourceName,
      sourceUrl: v.originalSource.sourceUrl,
      externalId: v.originalSource.externalId,
    });
  });

  it("maps professionId to null when the record has no profession slug", () => {
    const record = VERIFIED_VACANCIES.find((v) => v.professionSlug === null);
    if (!record) return;
    const input = vacancyToCuratedInput(record, idMap());
    expect(input.professionId).toBeNull();
  });

  it("falls back to null (never a dangling string) for a missing org/taxonomy id", () => {
    const v = VERIFIED_VACANCIES[2];
    const ids = idMap();
    delete ids.organizations[v.organizationSlug];
    delete ids.professions[v.professionSlug!];
    const input = vacancyToCuratedInput(v, ids);
    expect(input.organizationId).toBeUndefined(); // must not exist yet — populate on env
    expect(input.professionId).toBeNull();
  });
});