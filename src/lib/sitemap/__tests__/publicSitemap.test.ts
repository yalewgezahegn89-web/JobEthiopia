import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockJobsFindMany: vi.fn(),
  mockOrganizationsFindMany: vi.fn(),
  mockCategoriesFindMany: vi.fn(),
  mockProfessionsFindMany: vi.fn(),
  mockLocationsFindMany: vi.fn(),
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

import {
  buildSitemapUrls,
  collectSitemapData,
  SITEMAP_PAGE_LIMIT,
  type SitemapData,
} from "../publicSitemap";

function sqlContains(node: unknown, needle: string): boolean {
  return JSON.stringify(node).includes(needle);
}

function baseData(): SitemapData {
  return {
    staticPaths: ["/", "/jobs", "/careers"],
    jobs: [{ id: "job-1" }, { id: "job-2" }],
    organizations: [{ id: "org-1" }],
    categories: [{ id: "cat-1" }],
    professions: [{ id: "prof-1" }],
    locations: [{ id: "loc-1" }],
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
    },
  } as unknown as Parameters<typeof collectSitemapData>[0];
}

describe("buildSitemapUrls", () => {
  it("includes the static public paths", () => {
    const urls = buildSitemapUrls(baseData());
    const paths = urls.map((u) => u.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/jobs");
    expect(paths).toContain("/careers");
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

  it("never contains admin, dashboard, api, or auth paths", () => {
    const urls = buildSitemapUrls(baseData());
    for (const url of urls) {
      expect(url.path).not.toMatch(/^\/(admin|api|login|register|saved-jobs)\b/);
      expect(url.path).not.toMatch(/^\/organization\//);
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
  });

  it("queries active organizations and returns their ids", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(data.organizations).toEqual([{ id: "org-1" }]);
  });

  it("applies PUBLISHED, freshness, deadline, and active-org conditions to jobs", async () => {
    mocks.mockOrganizationsFindMany.mockResolvedValue([{ id: "org-1" }]);
    mocks.mockJobsFindMany.mockResolvedValue([{ id: "job-1" }]);
    mocks.mockCategoriesFindMany.mockResolvedValue([]);
    mocks.mockProfessionsFindMany.mockResolvedValue([]);
    mocks.mockLocationsFindMany.mockResolvedValue([]);

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

    const data = await collectSitemapData(makeQueryDb(), new Date("2026-01-01T00:00:00Z"));

    expect(data.staticPaths).toEqual(["/", "/jobs", "/careers"]);
    expect(data.jobs).toEqual([{ id: "job-1" }]);
    expect(data.organizations).toEqual([{ id: "org-1" }]);
    expect(data.categories).toEqual([{ id: "cat-1" }]);
    expect(data.professions).toEqual([{ id: "prof-1" }]);
    expect(data.locations).toEqual([{ id: "loc-1" }]);
  });
});
