import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockToggleUserActive: vi.fn(),
  mockRevokeUserSessions: vi.fn(),
  mockChangeUserRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/admin/users", () => ({
  toggleUserActive: (...args: unknown[]) => mocks.mockToggleUserActive(...args),
  revokeUserSessions: (...args: unknown[]) => mocks.mockRevokeUserSessions(...args),
  changeUserRole: (...args: unknown[]) => mocks.mockChangeUserRole(...args),
}));

import {
  toggleUserActiveAction,
  revokeUserSessionsAction,
  changeUserRoleAction,
} from "@/app/admin/users/actions";

const INITIAL: { ok: boolean } = { ok: false };
const VALID_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockToggleUserActive.mockResolvedValue({ ok: true, isActive: false });
  mocks.mockRevokeUserSessions.mockResolvedValue({ ok: true, sessionsRevoked: 2 });
  mocks.mockChangeUserRole.mockResolvedValue({ ok: true, fromRole: "MODERATOR", toRole: "ADMIN" });
});

function toggleForm(targetId: string = VALID_ID): FormData {
  const fd = new FormData();
  fd.set("targetId", targetId);
  return fd;
}

describe("toggleUserActiveAction", () => {
  it("toggles user active status", async () => {
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockToggleUserActive).toHaveBeenCalledWith(
      VALID_ID,
      "actor-1",
      "SUPER_ADMIN",
    );
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      toggleUserActiveAction(INITIAL, toggleForm()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects non-staff with redirect (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      toggleUserActiveAction(INITIAL, toggleForm()),
    ).rejects.toThrow("REDIRECT:/admin/users");
  });

  it("rejects CSRF", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("CsrfError"));
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects invalid UUID", async () => {
    const fd = new FormData();
    fd.set("targetId", "not-a-uuid");
    const result = await toggleUserActiveAction(INITIAL, fd);
    expect(result.ok).toBe(false);
  });

  it("rejects self-deactivation", async () => {
    mocks.mockToggleUserActive.mockResolvedValue({
      ok: false,
      code: "SELF_DEACTIVATION",
    });
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("own account");
  });

  it("rejects last SUPER_ADMIN deactivation", async () => {
    mocks.mockToggleUserActive.mockResolvedValue({
      ok: false,
      code: "LAST_SUPER_ADMIN",
    });
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SUPER_ADMIN");
  });

  it("rejects unauthorized toggle", async () => {
    mocks.mockToggleUserActive.mockResolvedValue({
      ok: false,
      code: "UNAUTHORIZED",
    });
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("returns generic error on DB failure", async () => {
    mocks.mockToggleUserActive.mockRejectedValue(new Error("db down"));
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("does not leak sensitive data in errors", async () => {
    mocks.mockToggleUserActive.mockRejectedValue(
      new Error("password_hash secret token"),
    );
    const result = await toggleUserActiveAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("password_hash");
    expect(result.error).not.toContain("secret");
    expect(result.error).not.toContain("token");
  });
});

describe("revokeUserSessionsAction", () => {
  it("revokes sessions for a user", async () => {
    const result = await revokeUserSessionsAction(INITIAL, toggleForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockRevokeUserSessions).toHaveBeenCalledWith(VALID_ID, "actor-1");
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      revokeUserSessionsAction(INITIAL, toggleForm()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects non-staff with redirect", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      revokeUserSessionsAction(INITIAL, toggleForm()),
    ).rejects.toThrow("REDIRECT:/admin/users");
  });

  it("rejects CSRF", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("CsrfError"));
    const result = await revokeUserSessionsAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
  });

  it("rejects invalid UUID", async () => {
    const fd = new FormData();
    fd.set("targetId", "not-a-uuid");
    const result = await revokeUserSessionsAction(INITIAL, fd);
    expect(result.ok).toBe(false);
  });

  it("rejects self-force-logout", async () => {
    mocks.mockRevokeUserSessions.mockResolvedValue({
      ok: false,
      code: "SELF_FORCE_LOGOUT",
    });
    const result = await revokeUserSessionsAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("own session");
  });

  it("returns generic error on DB failure", async () => {
    mocks.mockRevokeUserSessions.mockRejectedValue(new Error("db down"));
    const result = await revokeUserSessionsAction(INITIAL, toggleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

function changeRoleForm(targetId: string = VALID_ID, role: string = "ADMIN"): FormData {
  const fd = new FormData();
  fd.set("targetId", targetId);
  fd.set("role", role);
  return fd;
}

describe("changeUserRoleAction", () => {
  it("changes user role for SUPER_ADMIN actor", async () => {
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockChangeUserRole).toHaveBeenCalledWith(VALID_ID, "ADMIN", "actor-1");
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      changeUserRoleAction(INITIAL, changeRoleForm()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects non-staff with redirect", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      changeUserRoleAction(INITIAL, changeRoleForm()),
    ).rejects.toThrow("REDIRECT:/admin/users");
  });

  it("rejects non-SUPER_ADMIN actor", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: true,
      user: { id: "actor-2", email: "mod@example.com", name: "Mod", role: "MODERATOR" },
    });
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("rejects invalid UUID", async () => {
    const fd = changeRoleForm("not-a-uuid");
    const result = await changeUserRoleAction(INITIAL, fd);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid role", async () => {
    const fd = changeRoleForm(VALID_ID, "FAKE_ROLE");
    const result = await changeUserRoleAction(INITIAL, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid role");
  });

  it("rejects CSRF", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("CsrfError"));
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
  });

  it("returns self-change error", async () => {
    mocks.mockChangeUserRole.mockResolvedValue({ ok: false, code: "SELF_CHANGE" });
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("own role");
  });

  it("returns last SUPER_ADMIN error", async () => {
    mocks.mockChangeUserRole.mockResolvedValue({ ok: false, code: "LAST_SUPER_ADMIN" });
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("SUPER_ADMIN");
  });

  it("returns UNAUTHORIZED error from DAL", async () => {
    mocks.mockChangeUserRole.mockResolvedValue({ ok: false, code: "UNAUTHORIZED" });
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("returns generic error on DB failure", async () => {
    mocks.mockChangeUserRole.mockRejectedValue(new Error("db down"));
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("does not leak sensitive data in errors", async () => {
    mocks.mockChangeUserRole.mockRejectedValue(new Error("password_hash secret token"));
    const result = await changeUserRoleAction(INITIAL, changeRoleForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("password_hash");
    expect(result.error).not.toContain("secret");
  });
});
