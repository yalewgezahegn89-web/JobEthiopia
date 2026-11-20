import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockJobsFindMany: vi.fn(),
  mockOrganizationsFindMany: vi.fn(),
  mockCategoriesFindMany: vi.fn(),
  mockProfessionsFindMany: vi.fn(),
  mockLocationsFindMany: vi.fn(),
  mockCareerArticlesFindMany: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      jobs: {
        findMany: (...args: unknown[]) => mocks.mockJobsFindMany(...args),
      },
      organizations: {
        findMany: (...args: unknown[]) => mocks.mockOrganizationsFindMany(...args),
      },
      categories: {
        findMany: (...args: unknown[]) => mocks.mockCategoriesFindMany(...args),
      },
      professions: {
        findMany: (...args: unknown[]) => mocks.mockProfessionsFindMany(...args),
      },
      locations: {
        findMany: (...args: unknown[]) => mocks.mockLocationsFindMany(...args),
      },
      careerArticles: {
        findMany: (...args: unknown[]) =>
          mocks.mockCareerArticlesFindMany(...args),
      },
    },
  },
}));

vi.mock("../../../db/schema/jobs", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    status: "jobs.status",
    organizationId: "jobs.organization_id",
    categoryId: "jobs.category_id",
    professionId: "jobs.profession_id",
    locationId: "jobs.location_id",
    employmentType: "jobs.employment_type",
    description: "jobs.description",
    lastVerifiedAt: "jobs.last_verified_at",
    deadline: "jobs.deadline",
    createdAt: "jobs.created_at",
    updatedAt: "jobs.updated_at",
  },
}));

vi.mock("../../../db/schema/organizations", () => ({
  organizations: {
    id: "organizations.id",
    name: "organizations.name",
    slug: "organizations.slug",
    status: "organizations.status",
    createdAt: "organizations.created_at",
    updatedAt: "organizations.updated_at",
  },
}));

vi.mock("../../../db/schema/categories", () => ({
  categories: {
    id: "categories.id",
    name: "categories.name",
    slug: "categories.slug",
    isActive: "categories.is_active",
    createdAt: "categories.created_at",
    updatedAt: "categories.updated_at",
  },
}));

vi.mock("../../../db/schema/professions", () => ({
  professions: {
    id: "professions.id",
    name: "professions.name",
    slug: "professions.slug",
    isActive: "professions.is_active",
    createdAt: "professions.created_at",
    updatedAt: "professions.updated_at",
  },
}));

vi.mock("../../../db/schema/locations", () => ({
  locations: {
    id: "locations.id",
    name: "locations.name",
    slug: "locations.slug",
    isActive: "locations.is_active",
    createdAt: "locations.created_at",
    updatedAt: "locations.updated_at",
  },
}));

vi.mock("../../../db/schema/careerArticles", () => ({
  careerArticles: {
    id: "career_articles.id",
    status: "career_articles.status",
    publishedAt: "career_articles.published_at",
  },
}));

import {
  buildSitemapUrls,
  collectSitemapData,
  legalSitemapEntries,
  PUBLIC_STATIC_PATHS,
  SITEMAP_MAX_ENTITIES,
  SITEMAP_PAGE_LIMIT,
  type SitemapData,
} from "../publicSitemap";

function sqlContains(node: unknown, needle: string): boolean {
  return JSON.stringify(node).includes(needle);
}

function baseData(): SitemapData {
  return {
    staticPaths: [...PUBLIC_STATIC_PATHS],
    jobs: [{ id: "job-1" }, { id: "job-2" }],
    organizations: [{ id: "org-1" }],
    categories: [{ id: "cat-1" }],
    professions: [{ id: "prof-1" }],
    locations: [{ id: "loc-1" }],
    careerArticles: [{ id: "article-1" }],
  };
}

function makeQueryDb() {
  return {
    query: {
      jobs: {
        findMany: (args: unknown) => mocks.mockJobsFindMany(args),
      },
      organizations: {
        findMany: (args: unknown) => mocks.mockOrganizationsFindMany(args),
      },
      categories: {
        findMany: (args: unknown) => mocks.mockCategoriesFindMany(args),
      },
      professions: {
        findMany: (args: unknown) => mocks.mockProfessionsFindMany(args),
      },
      locations: {
        findMany: (args: unknown) => mocks.mockLocationsFindMany(args),
      },
      careerArticles: {
        findMany: (args: unknown) => mocks.mockCareerArticlesFindMany(args),
      },
    },
  } as unknown as Parameters<typeof collectSitemapData>[0];
}

describe("buildSitemapUrls", () => {
  it("includes every static public path in all three locales", () => {
    const urls = buildSitemapUrls(baseData());
    const paths = urls.map((u) => u.path);
    for (const path of PUBLIC_STATIC_PATHS) {
      expect(paths).toContain(path);
      expect(paths).toContain(`/am${path === "/" ? "" : path}`);
      expect(paths).toContain(`/om${path === "/" ? "" : path}`);
    }
  });

  it("gives localized static pages complete alternates with x-default", () => {
    const jobsEntry = buildSitemapUrls(baseData()).find(
      (entry) => entry.path === "/am/jobs",
    );
    expect(jobsEntry?.alternates?.languages).toEqual({
      en: "/jobs",
      am: "/am/jobs",
      om: "/om/jobs",
      "x-default": "/jobs",
    });
  });

  it("includes eligible public job URLs", () => {
    const urls = buildSitemapUrls(baseData());
    const paths = urls.map((u) => u.path);
    expect(paths).toContain("/jobs/job-1");
    expect(paths).toContain("/jobs/job-2");
  });

  it("includes active organization URLs", () => {
    const urls = buildSitemapUrls(baseData());
    expect(urls.map((u) => u.path)).toContain("/organizations/org-1");
  });

  it("includes active taxonomy URLs", () => {
    const urls = buildSitemapUrls(baseData());
    const paths = urls.map((u) => u.path);
    expect(paths).toContain("/categories/cat-1");
    expect(paths).toContain("/professions/prof-1");
    expect(paths).toContain("/locations/loc-1");
  });

  it("includes published career article URLs without locale alternates", () => {
    const entry = buildSitemapUrls(baseData()).find(
      (url) => url.path === "/careers/article-1",
    );
    expect(entry).toBeDefined();
    expect(entry?.alternates).toBeUndefined();
  });

  it("includes all nine localized legal page URLs", () => {
    const paths = buildSitemapUrls(baseData()).map((u) => u.path);
    for (const path of [
      "/privacy",
      "/am/privacy",
      "/om/privacy",
      "/terms",
      "/am/terms",
      "/om/terms",
      "/cookies",
      "/am/cookies",
      "/om/cookies",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("gives every legal URL complete language alternates", () => {
    const legal = buildSitemapUrls(baseData()).filter((entry) =>
      /\/(privacy|terms|cookies)$/.test(entry.path),
    );
    expect(legal).toHaveLength(9);
    for (const entry of legal) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual([
        "am",
        "en",
        "om",
        "x-default",
      ]);
      for (const path of Object.values(entry.alternates?.languages ?? {})) {
        expect(path).not.toMatch(/^https?:\/\//);
      }
    }
  });

  it("never contains admin, dashboard, api, or auth paths", () => {
    const urls = buildSitemapUrls(baseData());
    for (const url of urls) {
      expect(url.path).not.toMatch(/^\/(admin|api|login|register|saved-jobs)\b/);
      expect(url.path).not.toMatch(/^\/organization\//);
      expect(url.path).not.toMatch(/^\/(am|om)\/(admin|api|login|register)\b/);
    }
  });
});

describe("legalSitemapEntries", () => {
  it("returns exactly nine public entries with the effective date", () => {
    const entries = legalSitemapEntries();
    expect(entries).toHaveLength(9);
    for (const entry of entries) {
      expect(entry.lastModified).toBe("2026-11-19");
    }
  });
});

describe("collectSitemapData", () => {
  beforeEach(() => {
    mocks.mockJobsFindMany.mockReset();
    mocks.mockOrganizationsFindMany.mockReset();
    mocks.mockCategoriesFindMany.mockReset();
    mocks.mockProfessionsFindMany.mockReset();
    mocks.mockLocationsFindMany.mockReset();
    mocks.mockCareerArticlesFindMany.mockReset();
  });

  it("queries active organizations and returns their ids", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(data.organizations).toEqual([{ id: "org-1" }]);
  });

  it("applies PUBLISHED, freshness, deadline, and active-org conditions to jobs", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([{ id: "job-1" }]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    const jobsArgs = mocks.mockJobsFindMany.mock.calls[0][0];
    expect(jobsArgs.limit).toBe(SITEMAP_PAGE_LIMIT);
    expect(jobsArgs.offset).toBe(0);
    expect(jobsArgs.columns).toEqual({ id: true });
    expect(sqlContains(jobsArgs.where, "PUBLISHED")).toBe(true);
    expect(sqlContains(jobsArgs.where, "last_verified_at")).toBe(true);
    expect(sqlContains(jobsArgs.where, "deadline")).toBe(true);
    expect(sqlContains(jobsArgs.where, "org-1")).toBe(true);
  });

  it("forces an empty job set when there are no active organizations", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    const jobsArgs = mocks.mockJobsFindMany.mock.calls[0][0];
    expect(sqlContains(jobsArgs.where, "1 = 0")).toBe(true);
  });

  it("queries only active categories, professions, and locations", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    const cat = mocks.mockCategoriesFindMany.mock.calls[0][0];
    const prof = mocks.mockProfessionsFindMany.mock.calls[0][0];
    const loc = mocks.mockLocationsFindMany.mock.calls[0][0];
    expect(sqlContains(cat.where, "true")).toBe(true);
    expect(sqlContains(prof.where, "true")).toBe(true);
    expect(sqlContains(loc.where, "true")).toBe(true);
  });

  it("returns static and eligible entity ids", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([{ id: "job-1" }]);
    mocks.mockCategoriesFindMany.mockResolvedValue([{ id: "cat-1" }]);
    mocks.mockProfessionsFindMany.mockResolvedValue([{ id: "prof-1" }]);
    mocks.mockLocationsFindMany.mockResolvedValue([{ id: "loc-1" }]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([{ id: "article-1" }]);

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(data.staticPaths).toEqual([...PUBLIC_STATIC_PATHS]);
    expect(data.jobs).toEqual([{ id: "job-1" }]);
    expect(data.organizations).toEqual([{ id: "org-1" }]);
    expect(data.categories).toEqual([{ id: "cat-1" }]);
    expect(data.professions).toEqual([{ id: "prof-1" }]);
    expect(data.locations).toEqual([{ id: "loc-1" }]);
    expect(data.careerArticles).toEqual([{ id: "article-1" }]);
  });

  it("paginates past the first 500 eligible jobs", async () => {
    const firstPage = Array.from({ length: SITEMAP_PAGE_LIMIT }, (_, index) => ({
      id: `job-${index}`,
    }));
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: "job-extra" }]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(mocks.mockJobsFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.mockJobsFindMany.mock.calls[1][0].offset).toBe(
      SITEMAP_PAGE_LIMIT,
    );
    expect(data.jobs).toHaveLength(SITEMAP_PAGE_LIMIT + 1);
    expect(data.jobs.at(-1)).toEqual({ id: "job-extra" });
  });

  it("caps job collection so a runaway feed cannot produce an unbounded sitemap", async () => {
    const fullPage = Array.from({ length: SITEMAP_PAGE_LIMIT }, (_, index) => ({
      id: `job-${index}`,
    }));
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue(fullPage);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(data.jobs).toHaveLength(SITEMAP_MAX_ENTITIES);
  });

  it("paginates organizations, categories, professions, and locations past 500", async () => {
    const firstPage = Array.from({ length: SITEMAP_PAGE_LIMIT }, (_, index) => ({
      id: `entity-${index}`,
    }));
    mocks.mockOrganizationsFindMany
      .mockResolvedValueOnce([{ id: "org-1" }])
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: "org-extra" }]);
    mocks.mockCategoriesFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: "cat-extra" }]);
    mocks.mockProfessionsFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: "prof-extra" }]);
    mocks.mockLocationsFindMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([{ id: "loc-extra" }]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(
      makeQueryDb(),
      new Date("2026-01-01T00:00:00Z"),
    );

    expect(mocks.mockOrganizationsFindMany.mock.calls.at(-1)?.[0].offset).toBe(
      SITEMAP_PAGE_LIMIT,
    );
    expect(mocks.mockCategoriesFindMany.mock.calls[1][0].offset).toBe(
      SITEMAP_PAGE_LIMIT,
    );
    expect(mocks.mockProfessionsFindMany.mock.calls[1][0].offset).toBe(
      SITEMAP_PAGE_LIMIT,
    );
    expect(mocks.mockLocationsFindMany.mock.calls[1][0].offset).toBe(
      SITEMAP_PAGE_LIMIT,
    );
    expect(data.organizations).toHaveLength(SITEMAP_PAGE_LIMIT + 1);
    expect(data.categories.at(-1)).toEqual({ id: "cat-extra" });
    expect(data.professions.at(-1)).toEqual({ id: "prof-extra" });
    expect(data.locations.at(-1)).toEqual({ id: "loc-extra" });
  });

  it("caps all entity groups at the sitemap safety ceiling", async () => {
    const fullPage = Array.from({ length: SITEMAP_PAGE_LIMIT }, (_, index) => ({
      id: `entity-${index}`,
    }));
    mocks.mockOrganizationsFindMany
      .mockResolvedValueOnce([{ id: "org-1" }])
      .mockResolvedValue(fullPage);
    mocks.mockCategoriesFindMany.mockResolvedValue(fullPage);
    mocks.mockProfessionsFindMany.mockResolvedValue(fullPage);
    mocks.mockLocationsFindMany.mockResolvedValue(fullPage);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(
      makeQueryDb(),
      new Date("2026-01-01T00:00:00Z"),
    );

    expect(data.organizations).toHaveLength(SITEMAP_MAX_ENTITIES);
    expect(data.categories).toHaveLength(SITEMAP_MAX_ENTITIES);
    expect(data.professions).toHaveLength(SITEMAP_MAX_ENTITIES);
    expect(data.locations).toHaveLength(SITEMAP_MAX_ENTITIES);
  });

  it("queries only published career articles with a known past publication date", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);
    mocks.mockCareerArticlesFindMany.mockResolvedValue([]);

    await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    const articleArgs = mocks.mockCareerArticlesFindMany.mock.calls[0][0];
    expect(sqlContains(articleArgs.where, "PUBLISHED")).toBe(true);
    expect(sqlContains(articleArgs.where, "career_articles.published_at")).toBe(true);
    expect(articleArgs.limit).toBe(SITEMAP_PAGE_LIMIT);
  });
});
