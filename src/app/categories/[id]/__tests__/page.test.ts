import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchCategoryById: vi.fn(),
  mockFetchJobs: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(
      Fragment,
      null,
      createElement("a", { href, "data-testid": href }, children),
    ),
}));

vi.mock("@/lib/categories/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/categories/public")>();
  return {
    ...actual,
    fetchCategoryById: (...a: unknown[]) => mocks.mockFetchCategoryById(...a),
  };
});

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

import CategoryPage from "@/app/categories/[id]/page";

const CATEGORY_ID = "cat-1";

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CATEGORY_ID,
    name: "Finance",
    slug: "finance",
    description: "Accounting, banking, and financial services roles.",
    parentId: null,
    isActive: true,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: CATEGORY_ID,
    professionId: null,
    locationId: null,
    organizationName: "ACME Trading Plc",
    locationName: "Addis Ababa",
    categoryName: "Finance",
    professionName: "Accounting",
    employmentType: "FULL_TIME",
    salaryText: null,
    deadlineText: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    verificationStatus: null,
    status: "PUBLISHED",
    ...overrides,
  };
}

async function renderPage(): Promise<string> {
  const element = await CategoryPage({ params: Promise.resolve({ id: CATEGORY_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchCategoryById.mockResolvedValue(makeCategory());
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeJob()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
});

describe("CategoryPage", () => {
  it("renders breadcrumb with Home, Categories, and the category name", async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/categories"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the category name as a single H1 with its description", async () => {
    const html = await renderPage();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("Finance");
    expect(html).toContain("Accounting, banking, and financial services roles.");
  });

  it("links to the full jobs list for this category", async () => {
    const html = await renderPage();
    expect(html).toContain(`data-testid="/jobs?categoryId=${CATEGORY_ID}"`);
    expect(html).toContain("Browse all jobs in this category");
  });

  it("renders category jobs with the shared job card", async () => {
    const html = await renderPage();
    expect(html).toContain("Jobs in Finance");
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('data-testid="/jobs/job-1"');
  });

  it("renders an empty state when there are no jobs", async () => {
    mocks.mockFetchJobs.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No jobs right now");
    expect(html).toContain("There are no published jobs in this category at the moment.");
  });

  it("shows an error message when jobs fail to load", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load jobs in this category right now");
  });

  it("shows a retry state when the category fails to load", async () => {
    mocks.mockFetchCategoryById.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this category right now");
    expect(html).toContain("Back to Categories");
  });

  it("calls notFound when the category does not exist", async () => {
    mocks.mockFetchCategoryById.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});