import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Phase 6 Step 6 — Taxonomy Expansion (non-destructive, structural).
 *
 * The seed script (`src/db/seed.ts`) is a standalone script backed by a real
 * DATABASE_URL, so it cannot be imported into tests. These tests read the
 * seed source and verify, off-the-record, that:
 *   - the required reference taxonomy (categories / professions / locations)
 *     is present and wired to the correct parents,
 *   - every insert is idempotent (onConflictDoNothing + returning, one block
 *     per stable slug so repeated seeding cannot duplicate rows),
 *   - the existing reference data (Healthcare, Nursing, Ethiopia, Addis Ababa,
 *     Hawassa, Black Lion Hospital, Manual Entry provenance, and the demo job)
 *     is preserved intact,
 *   - no UNICEF/UNFPA organization or vacancy records were introduced.
 */

const SEED_PATH = join(process.cwd(), "src/db/seed.ts");
const seedSource = readFileSync(SEED_PATH, "utf8");

function insertBlocks(table: string): string[] {
  const re = new RegExp(
    `db\\s*\\.insert\\(${table}\\)\\s*\\.values\\(\\{\\s*([\\s\\S]*?)\\s*\\}\\)\\s*\\.onConflictDoNothing\\(\\)\\s*\\.returning\\(\\)`,
    "g",
  );
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(seedSource)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function blockFor(blocks: string[], slug: string): string {
  const block = blocks.find((b) => b.includes(`slug: "${slug}"`));
  expect(block, `seed block for slug "${slug}" not found`).toBeDefined();
  return block as string;
}

function slugCount(slug: string): number {
  return (seedSource.match(new RegExp(`slug: "${slug}"`, "g")) ?? []).length;
}

const locationsBlocks = insertBlocks("locations");
const categoriesBlocks = insertBlocks("categories");
const professionsBlocks = insertBlocks("professions");
const organizationsBlocks = insertBlocks("organizations");
const jobsBlocks = insertBlocks("jobs");
const careerArticleBlocks = insertBlocks("careerArticles");

describe("seed taxonomy — locations (Phase 6 Step 6)", () => {
  it("defines Ethiopia as a COUNTRY with no parent", () => {
    const ethiopia = blockFor(locationsBlocks, "ethiopia");
    expect(ethiopia).toContain('type: "COUNTRY"');
    expect(ethiopia).not.toContain("parentId");
  });

  it("defines Addis Ababa and Hawassa as cities under Ethiopia (unchanged)", () => {
    for (const slug of ["addis-ababa", "hawassa"]) {
      const block = blockFor(locationsBlocks, slug);
      expect(block).toContain('type: "CITY"');
      expect(block).toContain("parentId: ethiopiaId");
    }
  });

  it("places Semera under Ethiopia as a CITY", () => {
    const semera = blockFor(locationsBlocks, "semera");
    expect(semera).toContain('name: "Semera"');
    expect(semera).toContain('type: "CITY"');
    expect(semera).toContain("parentId: ethiopiaId");
  });

  it("places Konso under Ethiopia as a CITY", () => {
    const konso = blockFor(locationsBlocks, "konso");
    expect(konso).toContain('name: "Konso"');
    expect(konso).toContain('type: "CITY"');
    expect(konso).toContain("parentId: ethiopiaId");
  });

  it("attempts each location insert exactly once (no duplicate seed rows)", () => {
    for (const slug of [
      "ethiopia",
      "addis-ababa",
      "hawassa",
      "semera",
      "konso",
    ]) {
      expect(slugCount(slug)).toBe(1);
    }
  });
});

describe("seed taxonomy — categories (Phase 6 Step 6)", () => {
  it("preserves the existing Healthcare category", () => {
    const healthcare = blockFor(categoriesBlocks, "healthcare");
    expect(healthcare).toContain('name: "Healthcare"');
    expect(healthcare).toContain("sortOrder: 1");
  });

  it("adds Operations & Administration with a stable slug and description", () => {
    const block = blockFor(categoriesBlocks, "operations-administration");
    expect(block).toContain('name: "Operations & Administration"');
    expect(block).toMatch(/description:\s*"/);
  });

  it("adds Finance & Economics with a stable slug and description", () => {
    const block = blockFor(categoriesBlocks, "finance-economics");
    expect(block).toContain('name: "Finance & Economics"');
    expect(block).toMatch(/description:\s*"/);
  });

  it("adds Transport & Logistics with a stable slug and description", () => {
    const block = blockFor(categoriesBlocks, "transport-logistics");
    expect(block).toContain('name: "Transport & Logistics"');
    expect(block).toMatch(/description:\s*"/);
  });

  it("keeps Nutrition a profession, not a child category (flat category list)", () => {
    expect(slugCount("nutrition")).toBe(1);
    const nutrition = blockFor(professionsBlocks, "nutrition");
    expect(nutrition).toBeDefined();
    expect(categoriesBlocks.some((b) => b.includes('slug: "nutrition"'))).toBe(
      false,
    );
  });

  it("defines no parentId on any seeded category (top-level only)", () => {
    for (const slug of [
      "healthcare",
      "operations-administration",
      "finance-economics",
      "transport-logistics",
    ]) {
      expect(blockFor(categoriesBlocks, slug)).not.toContain("parentId");
    }
  });

  it("attempts each category insert exactly once (no duplicate seed rows)", () => {
    for (const slug of [
      "healthcare",
      "operations-administration",
      "finance-economics",
      "transport-logistics",
    ]) {
      expect(slugCount(slug)).toBe(1);
    }
  });
});

describe("seed taxonomy — professions (Phase 6 Step 6)", () => {
  it("preserves Nursing under Healthcare", () => {
    const nursing = blockFor(professionsBlocks, "nursing");
    expect(nursing).toContain('name: "Nursing"');
    expect(nursing).toContain("categoryId: healthcareId");
  });

  it("links Nutrition to Healthcare", () => {
    const nutrition = blockFor(professionsBlocks, "nutrition");
    expect(nutrition).toContain('name: "Nutrition"');
    expect(nutrition).toContain("categoryId: healthcareId");
  });

  it("links Operations to Operations & Administration", () => {
    const operations = blockFor(professionsBlocks, "operations");
    expect(operations).toContain('name: "Operations"');
    expect(operations).toContain(
      "categoryId: operationsAdministrationId",
    );
  });

  it("links Public Finance / Economic Policy to Finance & Economics", () => {
    const profession = blockFor(
      professionsBlocks,
      "public-finance-economic-policy",
    );
    expect(profession).toContain('name: "Public Finance / Economic Policy"');
    expect(profession).toContain("categoryId: financeEconomicsId");
  });

  it("links Driver to Transport & Logistics", () => {
    const driver = blockFor(professionsBlocks, "driver");
    expect(driver).toContain('name: "Driver"');
    expect(driver).toContain("categoryId: transportLogisticsId");
  });

  it("attempts each profession insert exactly once (no duplicate seed rows)", () => {
    for (const slug of [
      "nursing",
      "nutrition",
      "operations",
      "public-finance-economic-policy",
      "driver",
    ]) {
      expect(slugCount(slug)).toBe(1);
    }
  });
});

describe("seed taxonomy — idempotency pattern (Phase 6 Step 6)", () => {
  it("uses onConflictDoNothing + returning for every reference-data insert", () => {
    const taxonomyInserts = [
      ...locationsBlocks,
      ...categoriesBlocks,
      ...professionsBlocks,
    ];
    // 5 locations + 4 categories + 5 professions.
    expect(taxonomyInserts.length).toBe(14);
  });

  it("provides a slug-keyed lookup fallback after each captured insert", () => {
    // Captured ids must be re-resolvable by slug when the insert conflicts.
    expect(seedSource).toContain('eq(cats.slug, "operations-administration")');
    expect(seedSource).toContain('eq(cats.slug, "finance-economics")');
    expect(seedSource).toContain('eq(cats.slug, "transport-logistics")');
    expect(seedSource).toContain('eq(profs.slug, "nutrition")');
    expect(seedSource).toContain('eq(profs.slug, "operations")');
    expect(seedSource).toContain(
      'eq(profs.slug, "public-finance-economic-policy")',
    );
    expect(seedSource).toContain('eq(profs.slug, "driver")');
  });
});

describe("seed taxonomy — preserved reference data, no new vacancies (Phase 6 Step 6)", () => {
  it("keeps exactly the existing single organization (Black Lion Hospital)", () => {
    expect(organizationsBlocks.length).toBe(1);
    expect(blockFor(organizationsBlocks, "black-lion-hospital")).toContain(
      'name: "Black Lion Hospital"',
    );
  });

  it("keeps exactly the existing single job (Staff Nurse, DRAFT)", () => {
    expect(jobsBlocks.length).toBe(1);
    const job = blockFor(jobsBlocks, "staff-nurse-black-lion");
    expect(job).toContain('title: "Staff Nurse"');
    expect(job).toContain('status: "DRAFT"');
  });

  it("keeps sources and the career article intact", () => {
    expect(seedSource).toContain('name: "Manual Entry"');
    expect(seedSource).toContain("EMPLOYER_SOURCE_NAME");
    expect(seedSource).toContain("API_KEY_SOURCE_NAME");
    expect(careerArticleBlocks.length).toBe(1);
    expect(careerArticleBlocks[0]).toContain('slug: "how-to-write-a-professional-cv"');
  });

  it("introduces no UNICEF or UNFPA organizations or vacancy records", () => {
    expect(seedSource).not.toMatch(/UNICEF/);
    expect(seedSource).not.toMatch(/UNFPA/);
  });
});