import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchLocationById: vi.fn(),
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

vi.mock("@/lib/locations/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/locations/public")>();
  return {
    ...actual,
    fetchLocationById: (...a: unknown[]) => mocks.mockFetchLocationById(...a),
  };
});

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

import LocationPage, { generateMetadata } from "@/app/locations/[id]/page";

const LOCATION_ID = "loc-1";

function makeLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: LOCATION_ID,
    name: "Addis Ababa",
    slug: "addis-ababa",
    type: "CITY",
    parentId: null,
    isActive: true,
    latitude: 9.0192,
    longitude: 38.7525,
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
    categoryId: null,
    professionId: null,
    locationId: LOCATION_ID,
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
  const element = await LocationPage({ params: Promise.resolve({ id: LOCATION_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchLocationById.mockResolvedValue(makeLocation());
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeJob()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
});

describe("LocationPage", () => {
  it("renders breadcrumb with Home, Locations, and the location name", async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/locations"');
    expect(html).toContain('aria-current="page"');
  });

  it("renders the location name as a single H1 with its type label", async () => {
    const html = await renderPage();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("Addis Ababa");
    expect(html).toContain("CITY");
  });

  it("shows the parent location as a link when present", async () => {
    mocks.mockFetchLocationById
      .mockResolvedValueOnce(makeLocation({ parentId: "loc-0" }))
      .mockResolvedValueOnce(
        makeLocation({ id: "loc-0", name: "Oromia", type: "REGION", latitude: null, longitude: null }),
      );
    const html = await renderPage();
    expect(html).toContain('data-testid="/locations/loc-0"');
    expect(html).toContain("Part of");
    expect(html).toContain("Oromia");
  });

  it("does not show coordinates when they are absent", async () => {
    mocks.mockFetchLocationById.mockResolvedValue(
      makeLocation({ latitude: null, longitude: null }),
    );
    const html = await renderPage();
    expect(html).not.toContain("Latitude");
    expect(html).not.toContain("Longitude");
  });

  it("renders coordinates when present", async () => {
    const html = await renderPage();
    expect(html).toContain("Latitude");
    expect(html).toContain("9.0192");
    expect(html).toContain("38.7525");
  });

  it("links to the full jobs list for this location", async () => {
    const html = await renderPage();
    expect(html).toContain(`data-testid="/jobs?locationId=${LOCATION_ID}"`);
    expect(html).toContain("Browse all jobs in this location");
  });

  it("renders location jobs with the shared job card", async () => {
    const html = await renderPage();
    expect(html).toContain("Jobs in Addis Ababa");
    expect(html).toContain("Senior Accountant");
    expect(html).toContain('data-testid="/jobs/job-1"');
  });

  it("renders an empty state when there are no jobs", async () => {
    mocks.mockFetchJobs.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
    });
    const html = await renderPage();
    expect(html).toContain("No open jobs in this location");
  });

  it("shows an error message when jobs fail to load", async () => {
    mocks.mockFetchJobs.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load jobs in this location right now");
  });

  it("shows a retry state when the location fails to load", async () => {
    mocks.mockFetchLocationById.mockRejectedValue(new Error("boom"));
    const html = await renderPage();
    expect(html).toContain("We could not load this location right now");
    expect(html).toContain("Back to Locations");
  });

  it("calls notFound when the location does not exist", async () => {
    mocks.mockFetchLocationById.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOT_FOUND");
  });
});

describe("LocationPage generateMetadata", () => {
  it("returns dynamic title from the location name", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.title).toBe("Addis Ababa");
  });

  it("returns description based on location name and type", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.description).toContain("Addis Ababa");
    expect(metadata.description).toContain("city");
  });

  it("returns OpenGraph metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph!.title).toContain("Addis Ababa");
    expect(metadata.openGraph!.siteName).toBe("JobEthiopia");
    expect(metadata.openGraph!.type).toBe("website");
  });

  it("returns Twitter metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.twitter).toBeDefined();
    expect(metadata.twitter!.title).toContain("Addis Ababa");
    expect(metadata.twitter!.card).toBe("summary_large_image");
  });

  it("returns canonical URL using /locations/{id}", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.alternates).toBeDefined();
    expect(metadata.alternates!.canonical).toContain(`/locations/${LOCATION_ID}`);
  });

  it("returns fallback metadata for a missing location", async () => {
    mocks.mockFetchLocationById.mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.title).toBe("Location | JobEthiopia");
  });

  it("returns fallback metadata when fetching throws", async () => {
    mocks.mockFetchLocationById.mockRejectedValue(new Error("network error"));
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.title).toBe("Location | JobEthiopia");
  });

  it("formats location type in description", async () => {
    mocks.mockFetchLocationById.mockResolvedValue(makeLocation({ type: "REGION" }));
    const metadata = await generateMetadata({ params: Promise.resolve({ id: LOCATION_ID }) });
    expect(metadata.description).toContain("region");
  });
});