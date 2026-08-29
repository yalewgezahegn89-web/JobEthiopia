import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockVerifyOrg: vi.fn(),
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

vi.mock("@/lib/admin/organizations", () => ({
  verifyOrganization: (...args: unknown[]) => mocks.mockVerifyOrg(...args),
}));

import { verifyOrganizationAction } from "@/app/admin/organizations/actions";

const INITIAL: { ok: boolean } = { ok: false };

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("orgId", overrides.orgId ?? "11111111-1111-4111-8111-111111111111");
  fd.set("action", overrides.action ?? "VERIFY");
  if (overrides.notes !== undefined) {
    fd.set("notes", overrides.notes);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockVerifyOrg.mockResolvedValue({ ok: true });
});

describe("verifyOrganizationAction", () => {
  it("performs verification with the actor id from session", async () => {
    const result = await verifyOrganizationAction(INITIAL, form());
    expect(result.ok).toBe(true);
    expect(mocks.mockVerifyOrg).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "VERIFY",
      "actor-1",
      undefined,
    );
  });

  it("passes notes to the verification function", async () => {
    const result = await verifyOrganizationAction(
      INITIAL,
      form({ action: "REJECT", notes: "Missing docs" }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.mockVerifyOrg).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "REJECT",
      "actor-1",
      "Missing docs",
    );
  });

  it("rejects a non-staff user with a redirect (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(verifyOrganizationAction(INITIAL, form())).rejects.toThrow(
      "REDIRECT:/admin/organizations",
    );
    expect(mocks.mockVerifyOrg).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(verifyOrganizationAction(INITIAL, form())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.mockVerifyOrg).not.toHaveBeenCalled();
  });

  it("returns a safe generic error for an invalid org id", async () => {
    const result = await verifyOrganizationAction(INITIAL, form({ orgId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("not-a-uuid");
    expect(mocks.mockVerifyOrg).not.toHaveBeenCalled();
  });

  it("rejects an unknown action enum", async () => {
    const result = await verifyOrganizationAction(INITIAL, form({ action: "HACK_DB" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.mockVerifyOrg).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when CSRF validation fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await verifyOrganizationAction(INITIAL, form());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
    expect(result.error).not.toContain("origin");
  });

  it("returns a safe generic error when verification reports NOT_FOUND", async () => {
    mocks.mockVerifyOrg.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await verifyOrganizationAction(INITIAL, form());
    expect(result.ok).toBe(false);
  });

  it("returns a safe generic error when verification reports INVALID_STATE", async () => {
    mocks.mockVerifyOrg.mockResolvedValue({ ok: false, code: "INVALID_STATE" });
    const result = await verifyOrganizationAction(INITIAL, form());
    expect(result.ok).toBe(false);
  });

  it("returns a safe generic error on an unexpected DB failure without a stack", async () => {
    mocks.mockVerifyOrg.mockRejectedValue(new Error("connection refused: 10.0.0.1"));
    const result = await verifyOrganizationAction(INITIAL, form());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("connection");
  });

  it("rejects notes exceeding maximum length", async () => {
    const longNotes = "x".repeat(2001);
    const result = await verifyOrganizationAction(INITIAL, form({ notes: longNotes }));
    expect(result.ok).toBe(false);
    expect(mocks.mockVerifyOrg).not.toHaveBeenCalled();
  });

  it("accepts notes at exactly maximum length", async () => {
    const maxNotes = "x".repeat(2000);
    const result = await verifyOrganizationAction(INITIAL, form({ notes: maxNotes }));
    expect(result.ok).toBe(true);
    expect(mocks.mockVerifyOrg).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "VERIFY",
      "actor-1",
      maxNotes,
    );
  });
});
