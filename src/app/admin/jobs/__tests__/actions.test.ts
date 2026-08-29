import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockModerateJob: vi.fn(),
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

vi.mock("@/lib/admin/jobs", () => ({
  moderateJob: (...args: unknown[]) => mocks.mockModerateJob(...args),
}));

import { moderateJobAction } from "@/app/admin/jobs/actions";

const INITIAL: { ok: boolean } = { ok: false };

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("jobId", overrides.jobId ?? "11111111-1111-4111-8111-111111111111");
  fd.set("action", overrides.action ?? "PUBLISH");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockModerateJob.mockResolvedValue({ ok: true, state: { toStatus: "PUBLISHED" } });
});

describe("moderateJobAction", () => {
  it("performs moderation with the actor id from session", async () => {
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(true);
    expect(mocks.mockModerateJob).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "PUBLISH",
      "actor-1",
    );
  });

  it("rejects a non-staff user with a redirect (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: false,
      status: 403,
    });
    await expect(moderateJobAction(INITIAL,form())).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(moderateJobAction(INITIAL,form())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns a safe generic error for an invalid job id", async () => {
    const result = await moderateJobAction(INITIAL,form({ jobId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("not-a-uuid");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("rejects an unknown action enum", async () => {
    const result = await moderateJobAction(INITIAL,form({ action: "HACK_DB" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when CSRF origin validation fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
    expect(result.error).not.toContain("origin");
  });

  it("returns a safe generic error when moderation reports NOT_FOUND", async () => {
    mocks.mockModerateJob.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
  });

  it("returns a safe generic error when moderation reports FORBIDDEN transition", async () => {
    mocks.mockModerateJob.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("REMOVED");
  });

  it("returns a safe generic error on an unexpected DB failure without a stack", async () => {
    mocks.mockModerateJob.mockRejectedValue(new Error("connection refused: 10.0.0.1"));
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("connection");
  });
});
