import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFetchOrganizationById: vi.fn(),
  mockFetchJobs: vi.fn(),
}));

vi.mock("@/lib/organizations/public", () => ({
  fetchOrganizationById: (...args: unknown[]) =>
    mocks.mockFetchOrganizationById(...args),
}));

vi.mock("@/lib/jobs/public", () => ({
  fetchJobs: (...args: unknown[]) => mocks.mockFetchJobs(...args),
}));

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://jobethiopia.com",
}));

vi.mock("@/components/job-card", () => ({
  default: () => null,
}));

vi.mock("@/components/public/breadcrumb", () => ({
  Breadcrumb: () => null,
}));

vi.mock("@/components/public/icons", () => ({
  CheckIcon: () => null,
  BuildingIcon: () => null,
  ExternalLinkIcon: () => null,
}));

import { generateMetadata } from "../[id]/page";

const ACTIVE_ORG = {
  id: "org-1",
  name: "Ethio Health",
  slug: "ethio-health",
  industry: "Healthcare",
  logoUrl: null,
  websiteUrl: null,
  isVerified: true,
  status: "ACTIVE",
  description: "A trusted healthcare employer in Ethiopia.",
  locationId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const INACTIVE_ORG = { ...ACTIVE_ORG, status: "INACTIVE" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("organizations/[id] generateMetadata", () => {
  it("builds title, description, canonical, and OG for an active organization", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(ACTIVE_ORG);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "org-1" }),
    });

    expect(meta.title).toBe("Ethio Health");
    expect(meta.description).toContain("healthcare");
    expect(meta.alternates?.canonical).toBe(
      "https://jobethiopia.com/organizations/org-1",
    );
    expect(meta.openGraph?.title).toContain("Ethio Health");
    expect(meta.openGraph?.url).toBe(
      "https://jobethiopia.com/organizations/org-1",
    );
    expect(meta.openGraph?.siteName).toBe("JobEthiopia");
    expect(meta.robots).toBeUndefined();
  });

  it("returns fallback metadata when the organization is not found", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(null);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "missing" }),
    });

    expect(meta.title).toBe("Organization | JobEthiopia");
  });

  it("sets robots noindex for a non-public organization", async () => {
    mocks.mockFetchOrganizationById.mockResolvedValue(INACTIVE_ORG);

    const meta = await generateMetadata({
      params: Promise.resolve({ id: "org-1" }),
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.openGraph).toBeUndefined();
  });
});
