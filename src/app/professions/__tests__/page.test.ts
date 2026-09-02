import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchProfessions: vi.fn(),
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
    fetchProfessions: (...a: unknown[]) => mocks.mockFetchProfessions(...a),
  };
});

import ProfessionsPage from "@/app/professions/page";

function makeProfession(overrides: Record<string, unknown> = {}) {
  return {
    id: "prof-1",
    name: "Accounting",
    slug: "accounting",
    description: "Roles for accountants and auditors.",
    categoryId: "cat-1",
    isActive: true,
    ...overrides,
  };
}

async function renderPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await ProfessionsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfessionsPage", () => {
  it("renders breadcrumb and page header", async () => {
    mocks.mockFetchProfessions.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("Professions");
    expect(html).toContain("Find your path");
  });

  it("renders profession cards linking to their detail pages", async () => {
    mocks.mockFetchProfessions.mockResolvedValue({
      items: [makeProfession()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("Accounting");
    expect(html).toContain("Roles for accountants and auditors.");
    expect(html).toContain('data-testid="/professions/prof-1"');
    expect(html).toContain("Explore profession");
  });

  it("renders the empty state when there are no professions", async () => {
    mocks.mockFetchProfessions.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No professions found");
  });

  it("renders pagination links on multiple pages", async () => {
    mocks.mockFetchProfessions.mockResolvedValue({
      items: [makeProfession()],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const html = await renderPage();
    expect(html).toContain("?page=1");
    expect(html).toContain("Next");
  });

  it("renders a retry state when loading fails", async () => {
    mocks.mockFetchProfessions.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load professions right now");
    expect(html).toContain("Retry");
  });
});