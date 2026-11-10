import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const PROFESSION_ID = "22222222-2222-4222-8222-222222222222";
const LOCATION_ID = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  mockListPublicJobSummaries: vi.fn(),
  mockListActiveTaxonomyOptions: vi.fn(),
}));

vi.mock("@/lib/jobs/listPublicJobs", () => ({
  listPublicJobSummaries: (...args: unknown[]) =>
    mocks.mockListPublicJobSummaries(...args),
}));

vi.mock("@/lib/taxonomy/server", () => ({
  listActiveTaxonomyOptions: (...args: unknown[]) =>
    mocks.mockListActiveTaxonomyOptions(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(
      Fragment,
      null,
      createElement("a", { href, "data-testid": href }, children),
    ),
}));

vi.mock("@/lib/i18n/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/server")>();
  return { ...actual, getI18n: async () => dictionaries.en };
});

import JobsPage from "@/app/jobs/page";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: CATEGORY_ID,
    professionId: PROFESSION_ID,
    locationId: LOCATION_ID,
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    categoryName: "Finance",
    professionName: "Accounting",
    employmentType: "FULL_TIME",
    salaryText: null,
    deadlineText: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    ...overrides,
  };
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    name: "Finance",
    ...overrides,
  };
}

function makeProfession(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFESSION_ID,
    name: "Accounting",
    ...overrides,
  };
}

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: LOCATION_ID,
    name: "Addis Ababa",
    ...overrides,
  };
}

function makeResult(
  items = [makeJob()],
  paginationOverrides: Record<string, unknown> = {},
) {
  return {
    items,
    pagination: {
      page: 1,
      limit: 20,
      total: items.length,
      totalPages: 1,
      ...paginationOverrides,
    },
  };
}

async function renderJobs(
  searchParams: Record<string, string | undefined> = {},
): Promise<string> {
  const element = await JobsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockListPublicJobSummaries.mockResolvedValue(makeResult());
  mocks.mockListActiveTaxonomyOptions.mockResolvedValue({
    categories: [makeCategory()],
    professions: [makeProfession()],
    locations: [makeLocation()],
  });
});

describe("JobsPage", () => {
  it("renders a page heading", async () => {
    const html = await renderJobs();
    expect(html).toContain("Find a job that fits");
    expect(html).toContain("Job discovery");
  });

  it("renders a search form that preserves GET parameters and route", async () => {
    const html = await renderJobs();
    expect(html).toContain('action="/jobs"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="q"');
    expect(html).toContain("Search jobs by keyword");
  });

  it("preserves the keyword value in the search input", async () => {
    const html = await renderJobs({ q: "nurse" });
    expect(html).toContain('value="nurse"');
  });

  it("renders existing filter controls with labels", async () => {
    const html = await renderJobs();
    expect(html).toContain('name="categoryId"');
    expect(html).toContain('name="professionId"');
    expect(html).toContain('name="locationId"');
    expect(html).toContain('name="employmentType"');
    expect(html).toContain("Employment type");
  });

  it("preserves selected filter values", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([makeJob()], { total: 1, totalPages: 1 }),
    );
    const html = await renderJobs({
      categoryId: CATEGORY_ID,
      professionId: PROFESSION_ID,
      locationId: LOCATION_ID,
      employmentType: "FULL_TIME",
    });
    expect(html).toContain(`value="${CATEGORY_ID}"`);
    expect(html).toContain(`value="${PROFESSION_ID}"`);
    expect(html).toContain(`value="${LOCATION_ID}"`);
    expect(html).toContain('value="FULL_TIME"');
  });

  it("renders a truthful result count", async () => {
    const html = await renderJobs();
    expect(html).toContain("job found");
    expect(html).toContain(">1<");
    expect(html).toContain("Showing");
  });

  it("renders a plural result count for multiple jobs", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([makeJob(), { ...makeJob(), id: "job-2" }], {
        page: 2,
        limit: 20,
        total: 137,
        totalPages: 7,
      }),
    );
    const html = await renderJobs({ page: "2" });
    expect(html).toContain("137");
    expect(html).toMatch(/jobs found/);
    expect(html).toContain("21");
    expect(html).toContain("40");
  });

  it("renders result cards as links to the job detail page", async () => {
    const html = await renderJobs();
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('href="/jobs/job-1"');
  });

  it("shows an empty state when no jobs match the filters", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([], { total: 0, totalPages: 0 }),
    );
    const html = await renderJobs({ q: "zzz" });
    expect(html).toContain("No jobs found");
    expect(html).toContain("Browse all jobs");
  });

  it("renders the localized empty state (not load error) when a successful query returns zero eligible jobs", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([], { total: 0, totalPages: 0, page: 1, limit: 20 }),
    );
    const html = await renderJobs();
    expect(html).toContain(dictionaries.en.jobs.noFiltersHeading);
    expect(html).not.toContain(dictionaries.en.jobs.loadErrorHeading);
  });

  it("renders pagination with previous/next and current page", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([makeJob()], { page: 3, total: 55, totalPages: 3 }),
    );
    const html = await renderJobs({ page: "3" });
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain("Previous");
    expect(html).toContain('aria-current="page"');
  });

  it("shows an error state when the listing query fails", async () => {
    mocks.mockListPublicJobSummaries.mockRejectedValue(new Error("boom"));
    const html = await renderJobs();
    expect(html).toContain("We could not load jobs");
  });

  it("renders the localized load-error state for a genuine query failure", async () => {
    mocks.mockListPublicJobSummaries.mockRejectedValue(
      new Error("500 Internal Server Error"),
    );
    const html = await renderJobs();
    expect(html).toContain(dictionaries.en.jobs.loadErrorHeading);
    expect(html).toContain(dictionaries.en.jobs.loadErrorBody);
    expect(html).not.toContain(dictionaries.en.jobs.noFiltersHeading);
  });

  it("renders a plural result count from the available total", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([makeJob(), { ...makeJob(), id: "job-2" }], {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      }),
    );
    const html = await renderJobs();
    expect(html).toContain("jobs found");
    expect(html).toContain(">2<");
  });

  it("populates filter dropdowns from taxonomy data, not just job results", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(
      makeResult([
        makeJob({
          categoryId: "cat-a",
          categoryName: "Category A",
          professionId: "prof-a",
          professionName: "Profession A",
          locationId: "loc-a",
          locationName: "Location A",
        }),
      ]),
    );
    mocks.mockListActiveTaxonomyOptions.mockResolvedValue({
      categories: [
        makeCategory({ id: "cat-a", name: "Category A" }),
        makeCategory({ id: "cat-b", name: "Category B" }),
        makeCategory({ id: "cat-c", name: "Category C" }),
      ],
      professions: [
        makeProfession({ id: "prof-a", name: "Profession A" }),
        makeProfession({ id: "prof-b", name: "Profession B" }),
      ],
      locations: [
        makeLocation({ id: "loc-a", name: "Location A" }),
        makeLocation({ id: "loc-b", name: "Location B" }),
        makeLocation({ id: "loc-c", name: "Location C" }),
      ],
    });

    const html = await renderJobs();

    expect(html).toContain("Category B");
    expect(html).toContain("Category C");
    expect(html).toContain("Profession B");
    expect(html).toContain("Location B");
    expect(html).toContain("Location C");
  });

  it("preserves selected filter values after navigation", async () => {
    mocks.mockListPublicJobSummaries.mockResolvedValue(makeResult());
    const html = await renderJobs({
      categoryId: CATEGORY_ID,
      professionId: PROFESSION_ID,
      locationId: LOCATION_ID,
      employmentType: "FULL_TIME",
    });
    expect(html).toContain(`value="${CATEGORY_ID}"`);
    expect(html).toContain(`value="${PROFESSION_ID}"`);
    expect(html).toContain(`value="${LOCATION_ID}"`);
    expect(html).toContain('value="FULL_TIME"');
  });

  it("includes aria-label on the search form", async () => {
    const html = await renderJobs();
    expect(html).toContain('aria-label="Search jobs"');
  });

  it("renders jobs when taxonomy loading fails", async () => {
    mocks.mockListActiveTaxonomyOptions.mockRejectedValue(
      new Error("taxonomy boom"),
    );
    const html = await renderJobs();
    expect(html).toContain("Senior Accountant");
    expect(html).not.toContain("We could not load jobs");
  });

  it("passes parsed filters, sorting, and pagination to the shared listing", async () => {
    await renderJobs({
      q: "nurse",
      categoryId: CATEGORY_ID,
      professionId: PROFESSION_ID,
      locationId: LOCATION_ID,
      employmentType: "FULL_TIME",
      sort: "deadline",
      salaryMin: "1000",
      salaryMax: "2000",
      page: "3",
    });

    expect(mocks.mockListPublicJobSummaries).toHaveBeenCalledWith({
      page: 3,
      limit: 20,
      categoryId: CATEGORY_ID,
      professionId: PROFESSION_ID,
      locationId: LOCATION_ID,
      employmentType: "FULL_TIME",
      q: "nurse",
      sort: "deadline",
      salaryMin: 1000,
      salaryMax: 2000,
    });
  });

  it("does not make an unauthenticated HTTP self-fetch during render", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.reject(new Error("unexpected HTTP fetch")),
    );
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const html = await renderJobs();
      expect(html).toContain("Senior Accountant");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
