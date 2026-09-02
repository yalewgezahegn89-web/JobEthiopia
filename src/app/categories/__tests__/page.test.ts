import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
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
    fetchCategories: (...a: unknown[]) => mocks.mockFetchCategories(...a),
  };
});

import CategoriesPage from "@/app/categories/page";

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat-1",
    name: "Finance",
    slug: "finance",
    description: "Accounting, banking, and financial services roles.",
    parentId: null,
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
}

async function renderPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await CategoriesPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoriesPage", () => {
  it("renders breadcrumb and page header", async () => {
    mocks.mockFetchCategories.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("Categories");
    expect(html).toContain("Browse by field");
  });

  it("renders category cards linking to their detail pages", async () => {
    mocks.mockFetchCategories.mockResolvedValue({
      items: [makeCategory()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("Finance");
    expect(html).toContain("Accounting, banking, and financial services roles.");
    expect(html).toContain('data-testid="/categories/cat-1"');
    expect(html).toContain("Explore jobs");
  });

  it("marks subcategories with a label", async () => {
    mocks.mockFetchCategories.mockResolvedValue({
      items: [makeCategory({ parentId: "cat-0" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("Subcategory");
  });

  it("renders the empty state when there are no categories", async () => {
    mocks.mockFetchCategories.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No categories found");
  });

  it("renders pagination links on multiple pages", async () => {
    mocks.mockFetchCategories.mockResolvedValue({
      items: [makeCategory()],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const html = await renderPage();
    expect(html).toContain("?page=1");
    expect(html).toContain("Next");
  });

  it("renders a retry state when loading fails", async () => {
    mocks.mockFetchCategories.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load categories right now");
    expect(html).toContain("Retry");
  });
});