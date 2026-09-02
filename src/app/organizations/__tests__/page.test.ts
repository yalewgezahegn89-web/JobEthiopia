import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchOrganizations: vi.fn(),
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

vi.mock("@/lib/organizations/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/organizations/public")>();
  return {
    ...actual,
    fetchOrganizations: (...a: unknown[]) => mocks.mockFetchOrganizations(...a),
  };
});

import OrganizationsPage from "@/app/organizations/page";

function makeOrganization(overrides: Record<string, unknown> = {}) {
  return {
    id: "org-1",
    name: "ACME Trading Plc",
    slug: "acme-trading-plc",
    industry: "Import & Export",
    logoUrl: null,
    websiteUrl: "https://acme.example.com",
    isVerified: true,
    status: "ACTIVE",
    ...overrides,
  };
}

async function renderPage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const element = await OrganizationsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrganizationsPage", () => {
  it("renders breadcrumb and page header", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain("Organizations");
    expect(html).toContain("Hiring organizations");
  });

  it("renders organization cards linking to their detail pages", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [makeOrganization()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("ACME Trading Plc");
    expect(html).toContain('data-testid="/organizations/org-1"');
    expect(html).toContain("View organization");
  });

  it("shows initials when no logo is available", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [makeOrganization()],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("AT");
  });

  it("renders the logo image with the organization name alt text", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [makeOrganization({ logoUrl: "https://cdn.example.com/acme.png" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain('alt="ACME Trading Plc logo"');
    expect(html).toContain('src="https://cdn.example.com/acme.png"');
  });

  it("shows the Verified badge only for verified organizations", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [
        makeOrganization(),
        makeOrganization({ id: "org-2", name: "Beta Ltd", isVerified: false, websiteUrl: null }),
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html.match(/Verified/g) || []).toHaveLength(1);
    expect(html).toContain("ACME Trading Plc");
    expect(html).toContain("Beta Ltd");
  });

  it("shows industry and website only when present", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [
        makeOrganization(),
        makeOrganization({ id: "org-2", name: "Beta Ltd", industry: null, websiteUrl: null, isVerified: false }),
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    const html = await renderPage();
    expect(html).toContain("Import &amp; Export");
    expect(html).toContain("Website");
  });

  it("renders the empty state when there are no organizations", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No organizations found");
    expect(html).toContain("Check back soon.");
  });

  it("renders pagination links on multiple pages", async () => {
    mocks.mockFetchOrganizations.mockResolvedValue({
      items: [makeOrganization()],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const html = await renderPage();
    expect(html).toContain("?page=1");
    expect(html).toContain("Next");
    expect(html).toContain("Next");
  });

  it("renders a retry state when loading fails", async () => {
    mocks.mockFetchOrganizations.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load organizations right now");
    expect(html).toContain("Retry");
  });
});