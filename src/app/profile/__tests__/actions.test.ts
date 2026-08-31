import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCsrf: vi.fn(),
  mockUpdateProfile: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...args: unknown[]) => mocks.mockCsrf(...args),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/candidateProfile/dal", () => ({
  updateCandidateProfile: (...args: unknown[]) =>
    mocks.mockUpdateProfile(...args),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: (...args: unknown[]) => mocks.mockLogInfo(...args),
  logWarn: (...args: unknown[]) => mocks.mockLogWarn(...args),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...args: unknown[]) => mocks.mockGetRequestId(...args),
}));

import { updateProfileAction } from "@/app/profile/actions";
import { CsrfError } from "@/lib/auth/csrf";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

function makeForm(overrides: Record<string, unknown> = {}) {
  const fd = new FormData();
  fd.set("phone", "+251-911-234-567");
  fd.set("locationId", LOCATION_ID);
  fd.set("professionalSummary", "Engineer");
  fd.set("totalExperienceYears", "5");
  fd.set("education", "BSc");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, String(v));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockCsrf.mockResolvedValue(undefined);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
  mocks.mockUpdateProfile.mockResolvedValue({
    ok: true,
    changes: ["phone"],
    profile: {},
  });
});

describe("updateProfileAction", () => {
  it("redirects anonymous users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      updateProfileAction({ ok: false }, makeForm()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects non-candidate roles by redirecting to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(
      updateProfileAction({ ok: false }, makeForm()),
    ).rejects.toThrow("REDIRECT:/jobs");
  });

  it("rejects a CSRF failure", async () => {
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await updateProfileAction({ ok: false }, makeForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("succeeds for a CANDIDATE with valid input", async () => {
    const result = await updateProfileAction({ ok: false }, makeForm());
    expect(result.ok).toBe(true);
    expect(result.changes).toEqual(["phone"]);
  });

  it("does not read candidateId from the form (ignores forgeries)", async () => {
    const form = makeForm({ candidateId: "forged-0000-0000-0000-000000000000", userId: "forged-1" });
    const result = await updateProfileAction({ ok: false }, form);
    expect(result.ok).toBe(true);
    const [, input] = mocks.mockUpdateProfile.mock.calls[0];
    expect(input).not.toHaveProperty("candidateId");
    expect(input).not.toHaveProperty("userId");
  });

  it("rejects invalid input with field errors", async () => {
    const result = await updateProfileAction(
      { ok: false },
      makeForm({ phone: "123" }),
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.phone).toBeTruthy();
  });

  it("returns a generic error when the DAL fails", async () => {
    mocks.mockUpdateProfile.mockRejectedValue(new Error("db down"));
    const result = await updateProfileAction({ ok: false }, makeForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Unable to save your profile. Please try again.");
  });

  it("returns a generic error when the DAL reports failure", async () => {
    mocks.mockUpdateProfile.mockResolvedValue({ ok: false, code: "INVALID_INPUT" });
    const result = await updateProfileAction({ ok: false }, makeForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("logs success without PII", async () => {
    const result = await updateProfileAction({ ok: false }, makeForm());
    expect(result.ok).toBe(true);

    const logged = JSON.stringify(mocks.mockLogInfo.mock.calls.map((c) => c[1]));
    expect(logged).not.toContain("candidate@example.com");
    expect(logged).not.toContain("+251911234567");
    expect(logged).not.toContain("Engineer");
  });

  it("does not leak PII in failure logs", async () => {
    mocks.mockUpdateProfile.mockRejectedValue(new Error("db down"));
    await updateProfileAction({ ok: false }, makeForm());
    const logged = JSON.stringify(mocks.mockLogWarn.mock.calls.map((c) => c[1]));
    expect(logged).not.toContain("candidate@example.com");
    expect(logged).not.toContain("+251911234567");
  });
});
