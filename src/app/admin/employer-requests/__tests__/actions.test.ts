import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockRequireStaffAdmin: vi.fn(),
  mockCsrf: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockRequireStaffAdmin(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/admin/employerRequests", () => ({
  approveEmployerOnboarding: (...args: unknown[]) => mocks.mockApprove(...args),
  rejectEmployerOnboarding: (...args: unknown[]) => mocks.mockReject(...args),
  isValidUuid: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
}));

const mockRequireStaffAdmin = mocks.mockRequireStaffAdmin;
const mockCsrf = mocks.mockCsrf;
const mockApprove = mocks.mockApprove;
const mockReject = mocks.mockReject;

import {
  approveEmployerOnboardingAction,
  rejectEmployerOnboardingAction,
} from "../actions";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const GENERIC = "Unable to update this request. Please try again.";

function actor(role: string) {
  return { ok: true, user: { id: "33333333-3333-4333-8333-333333333333", role } };
}

function formWith(overrides: Record<string, string> = {}): FormData {
  const base = { requestId: REQUEST_ID, reviewNotes: "" };
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) form.set(k, v);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCsrf.mockResolvedValue(true);
  mockApprove.mockResolvedValue({ ok: true, organizationId: "org-id" });
  mockReject.mockResolvedValue({ ok: true });
});

describe("approveEmployerOnboardingAction", () => {
  it("lets an ADMIN approve a request", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("ADMIN"));
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith());
    expect(r).toEqual({ ok: true });
    expect(mockApprove).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", REQUEST_ID);
  });

  it("lets a SUPER_ADMIN approve a request", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("SUPER_ADMIN"));
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith());
    expect(r).toEqual({ ok: true });
  });

  it("denies a MODERATOR from approving", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("MODERATOR"));
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith());
    expect(r.ok).toBe(false);
    expect(r.error).toContain("permission");
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("redirects to login when unauthenticated", async () => {
    mockRequireStaffAdmin.mockResolvedValue({ ok: false, status: 401 });
    await expect(approveEmployerOnboardingAction({ ok: false }, formWith())).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("returns a generic error on invalid uuid", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("ADMIN"));
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith({ requestId: "bad" }));
    expect(r).toEqual({ ok: false, error: GENERIC });
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("returns a generic error on CSRF failure without approving", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockRequireStaffAdmin.mockResolvedValue(actor("ADMIN"));
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith());
    expect(r).toEqual({ ok: false, error: GENERIC });
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it("surfaces an INVALID_STATE error from the library", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("ADMIN"));
    mockApprove.mockResolvedValue({ ok: false, code: "INVALID_STATE" });
    const r = await approveEmployerOnboardingAction({ ok: false }, formWith());
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no longer pending");
  });
});

describe("rejectEmployerOnboardingAction", () => {
  it("lets a MODERATOR reject a request", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("MODERATOR"));
    const r = await rejectEmployerOnboardingAction({ ok: false }, formWith({ reviewNotes: "Duplicate" }));
    expect(r).toEqual({ ok: true });
    expect(mockReject).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      REQUEST_ID,
      "Duplicate",
    );
  });

  it("lets an ADMIN reject a request", async () => {
    mockRequireStaffAdmin.mockResolvedValue(actor("ADMIN"));
    const r = await rejectEmployerOnboardingAction({ ok: false }, formWith());
    expect(r).toEqual({ ok: true });
  });

  it("redirects to login when unauthenticated", async () => {
    mockRequireStaffAdmin.mockResolvedValue({ ok: false, status: 401 });
    await expect(rejectEmployerOnboardingAction({ ok: false }, formWith())).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("returns a generic error on CSRF failure without rejecting", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockRequireStaffAdmin.mockResolvedValue(actor("MODERATOR"));
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const r = await rejectEmployerOnboardingAction({ ok: false }, formWith());
    expect(r).toEqual({ ok: false, error: GENERIC });
    expect(mockReject).not.toHaveBeenCalled();
  });
});
