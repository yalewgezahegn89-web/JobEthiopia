import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchLocations: vi.fn(),
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

vi.mock("@/lib/locations/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/locations/public")>();
  return {
    ...actual,
    fetchLocations: (...a: unknown[]) => mocks.mockFetchLocations(...a),
  };
});

import LocationsPage from "@/app/locations/page";

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

async function renderPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await LocationsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LocationsPage", () => {
  it("renders breadcrumb and page header", async () => {
    mocks.mockFetchLocations.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain("Locations");
    expect(html).toContain("Explore by region");
  });

  it("renders location cards linking to their detail pages with type labels", async () => {
    mocks.mockFetchLocations.mockResolvedValue({
      items: [makeLocation()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("Addis Ababa");
    expect(html).toContain("CITY");
    expect(html).toContain('data-testid="/locations/loc-1"');
  });

  it("normalizes underscore type labels", async () => {
    mocks.mockFetchLocations.mockResolvedValue({
      items: [makeLocation({ type: "COUNTRY" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("COUNTRY");
  });

  it("renders the empty state when there are no locations", async () => {
    mocks.mockFetchLocations.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No locations found");
  });

  it("renders pagination links on multiple pages", async () => {
    mocks.mockFetchLocations.mockResolvedValue({
      items: [makeLocation()],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const html = await renderPage();
    expect(html).toContain("?page=1");
    expect(html).toContain("Next");
  });

  it("renders a retry state when loading fails", async () => {
    mocks.mockFetchLocations.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load locations right now");
    expect(html).toContain("Retry");
  });
});