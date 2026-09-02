import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchOrganizationById: vi.fn(),
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

vi.mock("@/lib/organizations/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/organizations/public")>();
  return {
    ...actual,
    fetchOrganizationById: (...a: unknown[]) => mocks.mockFetchOrganizationById(...a),
  };
});

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

import OrganizationPage from "@/app/organizations/[id]/page";

const ORG_ID = "org-1";

function makeOrganization(overrides: Record<string, unknown> = {}) {
  return {
    id: ORG_ID,
    name: "ACME Trading Plc",
    slug: "acme-trading-plc",
    industry: "Import & Export",
    logoUrl: null,
    websiteUrl: "https://acme.example.com",
    isVerified: true,
    status: "ACTIVE",
    description: "ACME is a leading trading company based in Addis Ababa.",
    locationId: null,
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
    organizationId: ORG_ID,
    categoryId: null,
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
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    ...overrides,
  };
}

async function renderPage(): Promise<string> {
  const element = await OrganizationPage({ params: Promise.resolve({ id: ORG_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchOrganizationById.mockResolvedValue(makeOrganization());
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeJob()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
});

describe("OrganizationPage", () => {
  it("renders breadcrumb with Home, Organizations, and the organization name", async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/organizations"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the organization name as a single H1", async () => {
    const html = await renderPage();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("ACME Trading Plc");
  });

  it("shows initials when no logo is available", async () => {
    const html = await renderPage();
    expect(html).toContain("AT");
  });

  it("renders the logo with an alt text when present", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(
      makeOrganization({ logoUrl: "https://cdn.example.com/acme.png" }),
    );
    const html = await renderPage();
    expect(html).toContain('alt="ACME Trading Plc logo"');
  });

  it("shows 'Verified employer' only for verified organizations", async () => {
    const html = await renderPage();
    expect(html).toContain("Verified employer");
    expect(html).toContain("bg-success-light");

    mocks.mockFetchOrganizationById.mockResolvedValue(makeOrganization({ isVerified: false }));
    const unverifiedHtml = await renderPage();
    expect(unverifiedHtml).not.toContain("Verified employer");
  });

  it("shows the industry badge", async () => {
    const html = await renderPage();
    expect(html).toContain("Import &amp; Export");
  });

  it("renders the website link with noopener noreferrer target blank", async () => {
    const html = await renderPage();
    expect(html).toContain('href="https://acme.example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Visit website");
  });

  it("omits the website link when no website exists", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(
      makeOrganization({ websiteUrl: null }),
    );
    const html = await renderPage();
    expect(html).not.toContain("Visit website");
  });

  it("renders the organization description", async () => {
    const html = await renderPage();
    expect(html).toContain("ACME is a leading trading company based in Addis Ababa.");
  });

  it("renders open jobs with the shared job card", async () => {
    const html = await renderPage();
    expect(html).toContain("Open jobs");
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('data-testid="/jobs/job-1"');
    expect(html).toContain("Addis Ababa");
  });

  it("renders the empty state when there are no open jobs", async () => {
    mocks.mockFetchJobs.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No open jobs right now");
    expect(html).toContain("no open positions at the moment");
  });

  it("shows an error message when jobs fail to load", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this organization");
    expect(html).not.toContain("Senior Accountant");
  });

  it("shows a retry state when the organization fails to load", async () => {
    mocks.mockFetchOrganizationById.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this organization right now");
    expect(html).toContain("Back to Organizations");
  });

  it("calls notFound when the organization does not exist", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});