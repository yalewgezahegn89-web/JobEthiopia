import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockListAuditLogs: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/audit", () => ({
  listAuditLogs: (...args: unknown[]) => mocks.mockListAuditLogs(...args),
}));

import AdminAuditPage from "@/app/admin/audit/page";

const AUDIT_RESULT = {
  items: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      action: "USER_ROLE_CHANGED",
      targetType: "user",
      targetId: "22222222-2222-4222-8222-222222222222",
      metadata: { fromRole: "MODERATOR", toRole: "ADMIN" },
      createdAt: "2026-03-15T10:00:00.000Z",
      actorEmail: "admin@example.com",
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
  mocks.mockListAuditLogs.mockResolvedValue(AUDIT_RESULT);
});

describe("AdminAuditPage", () => {
  it("renders the audit log for staff", async () => {
    const element = await AdminAuditPage({
      searchParams: Promise.resolve({}),
    });
    expect(element.type).toBe("div");
    expect(mocks.mockListAuditLogs).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminAuditPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminAuditPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders a safe error on DB failure", async () => {
    mocks.mockListAuditLogs.mockRejectedValue(new Error("db down"));
    const element = await AdminAuditPage({
      searchParams: Promise.resolve({}),
    });
    expect(element).toBeTruthy();
  });

  it("parses filter params from search params", async () => {
    await AdminAuditPage({
      searchParams: Promise.resolve({
        page: "2",
        action: "LOGIN_FAILURE",
        targetType: "user",
      }),
    });
    expect(mocks.mockListAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        action: "LOGIN_FAILURE",
        targetType: "user",
      }),
    );
  });

  it("passes empty string filters as undefined", async () => {
    await AdminAuditPage({
      searchParams: Promise.resolve({ action: "", targetType: "" }),
    });
    expect(mocks.mockListAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        action: undefined,
        targetType: undefined,
      }),
    );
  });
});
