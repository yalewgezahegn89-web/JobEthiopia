import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockFetchJobs: vi.fn(),
  mockFetchCareerArticles: vi.fn(),
  mockFetchCategories: vi.fn(),
  mockFetchProfessions: vi.fn(),
  mockFetchLocations: vi.fn(),
}));

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

vi.mock("@/lib/careerArticles/public", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/careerArticles/public")>();
  return {
    ...actual,
    fetchCareerArticles: (...a: unknown[]) =>
      mocks.mockFetchCareerArticles(...a),
  };
});

vi.mock("@/lib/categories/public", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/categories/public")>();
  return {
    ...actual,
    fetchCategories: (...a: unknown[]) => mocks.mockFetchCategories(...a),
  };
});

vi.mock("@/lib/professions/public", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/professions/public")>();
  return {
    ...actual,
    fetchProfessions: (...a: unknown[]) => mocks.mockFetchProfessions(...a),
  };
});

vi.mock("@/lib/locations/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/locations/public")>();
  return {
    ...actual,
    fetchLocations: (...a: unknown[]) => mocks.mockFetchLocations(...a),
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(
      Fragment,
      null,
      createElement("a", { href, "data-testid": href }, children),
    ),
}));

import Home from "@/app/page";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Accountant",
    slug: "accountant",
    organizationId: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    organizationName: "ACME Plc",
    locationName: null,
    categoryName: null,
    professionName: null,
    employmentType: null,
    salaryText: null,
    deadlineText: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    verificationStatus: null,
    status: "PUBLISHED",
    ...overrides,
  };
}

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: "article-1",
    title: "How to write a great CV",
    slug: "how-to-write-a-great-cv",
    category: "Career advice",
    excerpt: "Practical tips to improve your CV.",
    publishedAt: "Jan 5, 2026",
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: "loc-1",
    name: "Addis Ababa",
    slug: "addis-ababa",
    type: "CITY",
    parentId: null,
    isActive: true,
    ...overrides,
  };
}

function makeProfession(overrides: Record<string, unknown> = {}) {
  return {
    id: "prof-1",
    name: "Engineering",
    slug: "engineering",
    description: "Engineering roles",
    categoryId: null,
    isActive: true,
    ...overrides,
  };
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat-1",
    name: "Technology",
    slug: "technology",
    description: "Technology roles",
    parentId: null,
    isActive: true,
    sortOrder: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeJob()],
    pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
  });
  mocks.mockFetchCareerArticles.mockResolvedValue({
    items: [makeArticle()],
    pagination: { page: 1, limit: 3, total: 1, totalPages: 1 },
  });
  mocks.mockFetchCategories.mockResolvedValue({
    items: [makeCategory()],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  });
  mocks.mockFetchProfessions.mockResolvedValue({
    items: [makeProfession()],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  });
  mocks.mockFetchLocations.mockResolvedValue({
    items: [makeLocation()],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  });
});

async function renderHome(): Promise<string> {
  const element = await Home();
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(element);
}

describe("Homepage", () => {
  it("renders the hero headline and supporting copy", async () => {
    const html = await renderHome();
    expect(html).toContain("Find your next");
    expect(html).toContain("opportunity");
    expect(html).toContain("in Ethiopia");
    expect(html).toContain("Trusted Ethiopian job marketplace");
  });

  it("renders a working search form submitting to /jobs", async () => {
    const html = await renderHome();
    expect(html).toContain('action="/jobs"');
    expect(html).toContain("method=\"get\"");
    expect(html).toContain("name=\"q\"");
    expect(html).toContain("Search jobs by keyword");
    expect(html).not.toContain('name="q" placeholder=""');
  });

  it("renders the location filter populated with real locations", async () => {
    const html = await renderHome();
    expect(html).toContain('name="locationId"');
    expect(html).toContain('value="loc-1"');
    expect(html).toContain("Addis Ababa");
    expect(html).toContain("All locations");
  });

  it("renders the employer CTA and For Employers link", async () => {
    const html = await renderHome();
    expect(html).toContain("Are you hiring?");
    expect(html).toContain("Reach qualified candidates");
  });

  it("renders the latest jobs section with job titles", async () => {
    const html = await renderHome();
    expect(html).toContain("Latest Jobs");
    expect(html).toContain("Accountant");
    expect(html).toContain("ACME Plc");
  });

  it("renders closing soon section when closing jobs exist", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockFetchJobs.mockResolvedValue({
      items: [makeJob({ deadline: future })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderHome();
    expect(html).toContain("Closing soon");
    expect(html).toContain("Application deadlines");
  });

  it("renders closing soon jobs ordered by nearest deadline first", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const jobA = makeJob({
      id: "job-a",
      title: "Job A — 6 days",
      deadline: new Date(now + 6 * day).toISOString(),
    });
    const jobB = makeJob({
      id: "job-b",
      title: "Job B — 2 days",
      deadline: new Date(now + 2 * day).toISOString(),
    });
    const jobC = makeJob({
      id: "job-c",
      title: "Job C — 4 days",
      deadline: new Date(now + 4 * day).toISOString(),
    });

    const regularJobs = [
      makeJob({ id: "reg-1", title: "Regular 1" }),
      makeJob({ id: "reg-2", title: "Regular 2" }),
    ];

    mocks.mockFetchJobs.mockImplementation((query: { limit?: number }) => {
      if (query.limit === 5) {
        return Promise.resolve({
          items: regularJobs,
          pagination: { page: 1, limit: 5, total: 2, totalPages: 1 },
        });
      }
      return Promise.resolve({
        items: [jobA, jobB, jobC],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      });
    });

    const html = await renderHome();

    expect(html).toContain("Closing soon");

    const posB = html.indexOf("Job B — 2 days");
    const posC = html.indexOf("Job C — 4 days");
    const posA = html.indexOf("Job A — 6 days");

    expect(posB).toBeGreaterThan(-1);
    expect(posC).toBeGreaterThan(-1);
    expect(posA).toBeGreaterThan(-1);
    expect(posB).toBeLessThan(posC);
    expect(posC).toBeLessThan(posA);
  });

  it("renders explore sections with professions, categories, and locations", async () => {
    const html = await renderHome();
    expect(html).toContain("Explore careers by path");
    expect(html).toContain("Explore jobs by location");
    expect(html).toContain("Engineering");
    expect(html).toContain("Technology");
  });

  it("renders the employer section", async () => {
    const html = await renderHome();
    expect(html).toContain("Are you hiring?");
  });

  it("renders career resources with article title and editorial link", async () => {
    const html = await renderHome();
    expect(html).toContain("Grow your career");
    expect(html).toContain("How to write a great CV");
    expect(html).toContain("Read article");
  });

  it("does not fabricate statistics or success metrics", async () => {
    const html = await renderHome();
    expect(html).not.toMatch(/\d{1,3}(,\d{3})*\s*(jobs|employers|candidates|users)/i);
    expect(html).not.toContain("10,000");
    expect(html).not.toContain("1 million");
    expect(html).not.toContain("500 employers");
  });

  it("provides accessible labels and landmarks", async () => {
    const html = await renderHome();
    expect(html).toContain('<label for="q"');
    expect(html).toContain('<label for="locationId"');
    expect(html).toContain('action="/jobs"');
    expect(html).toContain("method=\"get\"");
  });

  it("shows empty state when jobs fail to load", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderHome();
    expect(html).toContain("We could not load the latest jobs right now");
  });

  it("shows empty state when articles fail to load", async () => {
    mocks.mockFetchCareerArticles.mockRejectedValue(new Error("boom"));
    const html = await renderHome();
    expect(html).toContain(
      "We could not load the latest career resources right now",
    );
  });
});
