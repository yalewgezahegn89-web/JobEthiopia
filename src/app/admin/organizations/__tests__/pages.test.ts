import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockListOrgs: vi.fn(),
  mockGetOrg: vi.fn(),
  mockGetAudit: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/organizations", () => ({
  listOrganizations: (...args: unknown[]) => mocks.mockListOrgs(...args),
  getOrganization: (...args: unknown[]) => mocks.mockGetOrg(...args),
  getOrganizationAuditHistory: (...args: unknown[]) => mocks.mockGetAudit(...args),
}));

import AdminOrganizationsPage from "@/app/admin/organizations/page";
import AdminOrganizationDetailPage from "@/app/admin/organizations/[id]/page";

const ORG_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Org",
  slug: "test-org",
  industry: "Tech",
  status: "ACTIVE",
  isVerified: false,
  verifiedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const FULL_ORG = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Org",
  slug: "test-org",
  description: "A description",
  industry: "Tech",
  websiteUrl: null,
  logoUrl: null,
  locationId: null,
  isVerified: true,
  status: "ACTIVE",
  verifiedAt: new Date("2026-01-15T00:00:00.000Z"),
  verifiedBy: null,
  verificationNotes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
});

describe("AdminOrganizationsPage", () => {
  it("renders the list for staff", async () => {
    mocks.mockListOrgs.mockResolvedValue({
      items: [ORG_SUMMARY],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const element = await AdminOrganizationsPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe("div");
    expect(mocks.mockListOrgs).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminOrganizationsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminOrganizationsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockListOrgs.mockRejectedValue(new Error("db down"));
    const element = await AdminOrganizationsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("renders an empty list", async () => {
    mocks.mockListOrgs.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    const element = await AdminOrganizationsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses isVerified filter from search params", async () => {
    mocks.mockListOrgs.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 1 });
    await AdminOrganizationsPage({
      searchParams: Promise.resolve({ isVerified: "true" }),
    });
    expect(mocks.mockListOrgs).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true }),
    );
  });

  it("parses page filter from search params", async () => {
    mocks.mockListOrgs.mockResolvedValue({ items: [], page: 2, limit: 20, total: 0, totalPages: 1 });
    await AdminOrganizationsPage({
      searchParams: Promise.resolve({ page: "2" }),
    });
    expect(mocks.mockListOrgs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});

describe("AdminOrganizationDetailPage", () => {
  it("renders org detail with audit history for staff", async () => {
    mocks.mockGetOrg.mockResolvedValue(FULL_ORG);
    mocks.mockGetAudit.mockResolvedValue([
      {
        id: "e1",
        action: "ORGANIZATION_VERIFIED",
        targetType: "organization",
        targetId: FULL_ORG.id,
        metadata: { fromStatus: "UNVERIFIED", toStatus: "VERIFIED" },
        createdAt: "2026-01-15T00:00:00.000Z",
        actorEmail: "admin@example.com",
      },
    ]);
    const element = await AdminOrganizationDetailPage({
      params: Promise.resolve({ id: FULL_ORG.id }),
    });
    expect(element).toBeTruthy();
    expect(mocks.mockGetAudit).toHaveBeenCalledWith(FULL_ORG.id);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminOrganizationDetailPage({ params: Promise.resolve({ id: FULL_ORG.id }) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("calls notFound for a missing organization", async () => {
    mocks.mockGetOrg.mockResolvedValue(null);
    await expect(
      AdminOrganizationDetailPage({ params: Promise.resolve({ id: FULL_ORG.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockGetOrg.mockRejectedValue(new Error("db down"));
    const element = await AdminOrganizationDetailPage({
      params: Promise.resolve({ id: FULL_ORG.id }),
    });
    expect(element).toBeTruthy();
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminOrganizationDetailPage({ params: Promise.resolve({ id: FULL_ORG.id }) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });
});
