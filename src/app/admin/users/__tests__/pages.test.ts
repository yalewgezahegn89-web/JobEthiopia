import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockListUsers: vi.fn(),
  mockGetUser: vi.fn(),
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

vi.mock("@/lib/admin/users", () => ({
  listUsers: (...args: unknown[]) => mocks.mockListUsers(...args),
  getUser: (...args: unknown[]) => mocks.mockGetUser(...args),
  getUserAuditHistory: (...args: unknown[]) => mocks.mockGetAudit(...args),
}));

import AdminUsersPage from "@/app/admin/users/page";
import AdminUserDetailPage from "@/app/admin/users/[id]/page";

const USER_SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test User",
  email: "test@example.com",
  role: "MODERATOR",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sessionCount: 2,
};

const FULL_USER = {
  ...USER_SUMMARY,
  role: "MODERATOR" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
});

describe("AdminUsersPage", () => {
  it("renders the list for staff", async () => {
    mocks.mockListUsers.mockResolvedValue({
      items: [USER_SUMMARY],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const element = await AdminUsersPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe("div");
    expect(mocks.mockListUsers).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminUsersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminUsersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockListUsers.mockRejectedValue(new Error("db down"));
    const element = await AdminUsersPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("renders an empty list", async () => {
    mocks.mockListUsers.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    const element = await AdminUsersPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses page/isActive/role filters from search params", async () => {
    mocks.mockListUsers.mockResolvedValue({
      items: [],
      page: 2,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    await AdminUsersPage({
      searchParams: Promise.resolve({ page: "2", isActive: "true", role: "ADMIN" }),
    });
    expect(mocks.mockListUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, isActive: true, role: "ADMIN" }),
    );
  });
});

describe("AdminUserDetailPage", () => {
  it("renders user detail with audit history for staff", async () => {
    mocks.mockGetUser.mockResolvedValue(FULL_USER);
    mocks.mockGetAudit.mockResolvedValue([
      {
        id: "e1",
        action: "USER_ACTIVATED",
        targetType: "user",
        targetId: FULL_USER.id,
        metadata: { fromIsActive: false, toIsActive: true },
        createdAt: "2026-01-02T00:00:00.000Z",
        actorEmail: "admin@example.com",
      },
    ]);
    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: FULL_USER.id }),
    });
    expect(element).toBeTruthy();
    expect(mocks.mockGetAudit).toHaveBeenCalledWith(FULL_USER.id);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminUserDetailPage({ params: Promise.resolve({ id: FULL_USER.id }) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("calls notFound for a missing user", async () => {
    mocks.mockGetUser.mockResolvedValue(null);
    await expect(
      AdminUserDetailPage({ params: Promise.resolve({ id: FULL_USER.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockGetUser.mockRejectedValue(new Error("db down"));
    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: FULL_USER.id }),
    });
    expect(element).toBeTruthy();
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminUserDetailPage({ params: Promise.resolve({ id: FULL_USER.id }) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });
});
