import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchProfessionById: vi.fn(),
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

vi.mock("@/lib/professions/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/professions/public")>();
  return {
    ...actual,
    fetchProfessionById: (...a: unknown[]) => mocks.mockFetchProfessionById(...a),
  };
});

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

import ProfessionPage from "@/app/professions/[id]/page";

const PROFESSION_ID = "prof-1";

function makeProfession(overrides: Record<string, unknown> = {}) {
  return {
    id: PROFESSION_ID,
    name: "Accounting",
    slug: "accounting",
    description: "Roles for accountants and auditors.",
    categoryId: "cat-1",
    isActive: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeCategory() {
  return {
    id: "cat-1",
    name: "Finance",
    slug: "finance",
    description: null,
    parentId: null,
    isActive: true,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: null,
    categoryId: "cat-1",
    professionId: PROFESSION_ID,
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
  const element = await ProfessionPage({ params: Promise.resolve({ id: PROFESSION_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchProfessionById.mockResolvedValue(makeProfession());
  mocks.mockFetchCategoryById.mockResolvedValue(makeCategory());
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeJob()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
});

describe("ProfessionPage", () => {
  it("renders breadcrumb with Home, Professions, and the profession name", async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/professions"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the profession name as a single H1 with its description", async () => {
    const html = await renderPage();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("Accounting");
    expect(html).toContain("Roles for accountants and auditors.");
  });

  it("links to the parent category when present", async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="/categories/cat-1"');
    expect(html).toContain("Part of Finance");
  });

  it("does not show the category link when the category is missing", async () => {
    mocks.mockFetchCategoryById.mockResolvedValue(null);
    const html = await renderPage();
    expect(html).not.toContain("Part of");
  });

  it("links to the full jobs list for this profession", async () => {
    const html = await renderPage();
    expect(html).toContain(`data-testid="/jobs?professionId=${PROFESSION_ID}"`);
    expect(html).toContain("Browse all jobs in this profession");
  });

  it("renders profession jobs with the shared job card", async () => {
    const html = await renderPage();
    expect(html).toContain("Jobs in Accounting");
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('data-testid="/jobs/job-1"');
  });

  it("renders an empty state when there are no jobs", async () => {
    mocks.mockFetchJobs.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No open jobs in this profession");
  });

  it("shows an error message when jobs fail to load", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load jobs in this profession right now");
  });

  it("shows a retry state when the profession fails to load", async () => {
    mocks.mockFetchProfessionById.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this profession right now");
    expect(html).toContain("Back to Professions");
  });

  it("calls notFound when the profession does not exist", async () => {
    mocks.mockFetchProfessionById.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});