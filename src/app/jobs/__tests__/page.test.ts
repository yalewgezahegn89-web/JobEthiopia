import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchJobs: vi.fn(),
}));

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
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

import JobsPage from "@/app/jobs/page";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: "cat-1",
    professionId: "prof-1",
    locationId: "loc-1",
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

function makeResult(items = [makeJob()], paginationOverrides: Record<string, unknown> = {}) {
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

async function renderJobs(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await JobsPage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchJobs.mockResolvedValue(makeResult());
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
    expect(html).toContain("method=\"get\"");
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
    mocks.mockFetchJobs.mockResolvedValue(
      makeResult([makeJob()], { total: 1, totalPages: 1 }),
    );
    const html = await renderJobs({
      categoryId: "cat-1",
      professionId: "prof-1",
      locationId: "loc-1",
      employmentType: "FULL_TIME",
    });
    expect(html).toContain('value="cat-1"');
    expect(html).toContain('value="prof-1"');
    expect(html).toContain('value="loc-1"');
    expect(html).toContain('value="FULL_TIME"');
  });

  it("renders a truthful result count", async () => {
    const html = await renderJobs();
    expect(html).toContain("job found");
    expect(html).toContain(">1<");
    expect(html).toContain("Showing");
  });

  it("renders a plural result count for multiple jobs", async () => {
    mocks.mockFetchJobs.mockResolvedValue(
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
    mocks.mockFetchJobs.mockResolvedValue(makeResult([], { total: 0, totalPages: 0 }));
    const html = await renderJobs({ q: "zzz" });
    expect(html).toContain("No jobs found");
    expect(html).toContain("Browse all jobs");
  });

  it("renders pagination with previous/next and current page", async () => {
    mocks.mockFetchJobs.mockResolvedValue(
      makeResult([makeJob()], { page: 3, total: 55, totalPages: 3 }),
    );
    const html = await renderJobs({ page: "3" });
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain("Previous");
    expect(html).toContain("aria-current=\"page\"");
  });

  it("shows an error state when the fetch fails", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderJobs();
    expect(html).toContain("We could not load jobs");
  });

  it("renders a plural result count from the available total", async () => {
    mocks.mockFetchJobs.mockResolvedValue(
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
});
