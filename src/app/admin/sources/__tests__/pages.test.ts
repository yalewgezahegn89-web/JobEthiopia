import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockListSources: vi.fn(),
  mockGetSource: vi.fn(),
  mockGetAudit: vi.fn(),
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

vi.mock("@/lib/admin/sources", () => ({
  listSources: (...args: unknown[]) => mocks.mockListSources(...args),
  getSource: (...args: unknown[]) => mocks.mockGetSource(...args),
  getSourceAuditHistory: (...args: unknown[]) => mocks.mockGetAudit(...args),
}));

import AdminSourcesPage from "@/app/admin/sources/page";
import AdminSourceDetailPage from "@/app/admin/sources/[id]/page";

const SOURCE_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Source",
  sourceType: "WEBSITE",
  baseUrl: "https://example.com",
  isActive: true,
  trustLevel: "MEDIUM",
  lastSuccessfulCheck: null,
  consecutiveFailures: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const FULL_SOURCE = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Source",
  sourceType: "WEBSITE",
  baseUrl: "https://example.com",
  isActive: true,
  trustLevel: "MEDIUM",
  lastSuccessfulCheck: null,
  lastAttemptedCheck: null,
  lastError: null,
  checkFrequencyMinutes: 60,
  consecutiveFailures: 0,
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

describe("AdminSourcesPage", () => {
  it("renders the list for staff", async () => {
    mocks.mockListSources.mockResolvedValue({
      items: [SOURCE_SUMMARY],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const element = await AdminSourcesPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe("div");
    expect(mocks.mockListSources).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminSourcesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminSourcesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockListSources.mockRejectedValue(new Error("db down"));
    const element = await AdminSourcesPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("renders an empty list", async () => {
    mocks.mockListSources.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    const element = await AdminSourcesPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses page/isActive/sourceType filters from search params", async () => {
    mocks.mockListSources.mockResolvedValue({ items: [], page: 2, limit: 20, total: 0, totalPages: 1 });
    await AdminSourcesPage({
      searchParams: Promise.resolve({ page: "2", isActive: "true", sourceType: "API" }),
    });
    expect(mocks.mockListSources).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, isActive: true, sourceType: "API" }),
    );
  });
});

describe("AdminSourceDetailPage", () => {
  it("renders source detail with audit history for staff", async () => {
    mocks.mockGetSource.mockResolvedValue(FULL_SOURCE);
    mocks.mockGetAudit.mockResolvedValue([
      {
        id: "e1",
        action: "SOURCE_CREATED",
        targetType: "source",
        targetId: FULL_SOURCE.id,
        metadata: { name: "Test Source" },
        createdAt: "2026-01-02T00:00:00.000Z",
        actorEmail: "admin@example.com",
      },
    ]);
    const element = await AdminSourceDetailPage({
      params: Promise.resolve({ id: FULL_SOURCE.id }),
    });
    expect(element).toBeTruthy();
    expect(mocks.mockGetAudit).toHaveBeenCalledWith(FULL_SOURCE.id);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminSourceDetailPage({ params: Promise.resolve({ id: FULL_SOURCE.id }) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("calls notFound for a missing source", async () => {
    mocks.mockGetSource.mockResolvedValue(null);
    await expect(
      AdminSourceDetailPage({ params: Promise.resolve({ id: FULL_SOURCE.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockGetSource.mockRejectedValue(new Error("db down"));
    const element = await AdminSourceDetailPage({
      params: Promise.resolve({ id: FULL_SOURCE.id }),
    });
    expect(element).toBeTruthy();
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminSourceDetailPage({ params: Promise.resolve({ id: FULL_SOURCE.id }) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });
});
