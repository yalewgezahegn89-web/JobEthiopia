import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCsrf: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockResubmit: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...args: unknown[]) => mocks.mockGetCurrentUser(...args),
}));

vi.mock("@/lib/employerOnboarding/dal", () => ({
  resubmitEmployerOnboarding: (...args: unknown[]) => mocks.mockResubmit(...args),
}));

const mockCsrf = mocks.mockCsrf;
const mockGetCurrentUser = mocks.mockGetCurrentUser;
const mockResubmit = mocks.mockResubmit;

import { resubmitEmployerOnboardingAction } from "../actions";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function formWith(overrides: Record<string, string> = {}): FormData {
  const base = {
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    industry: "",
    description: "",
    websiteUrl: "",
    contactPhone: "",
    locationId: "",
  };
  const merged = { ...base, ...overrides };
  const form = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    form.set(k, v);
  }
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitState();
  mockCsrf.mockResolvedValue(true);
  mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
  mockResubmit.mockResolvedValue({ ok: true, requestId: "new-request-id" });
});

afterEach(() => {
  resetRateLimitState();
});

describe("employer onboarding re-submission server action", () => {
  it("redirects to /employer/status on success using the session user", async () => {
    await expect(
      resubmitEmployerOnboardingAction({}, formWith()),
    ).rejects.toThrow("REDIRECT:/employer/status");

    expect(mockResubmit).toHaveBeenCalledTimes(1);
    const [userId, input] = mockResubmit.mock.calls[0] as [string, Record<string, unknown>];
    expect(userId).toBe(USER_ID);
    expect(input.organizationName).toBe("Almaz Coffee PLC");
    expect(input.organizationSlug).toBe("almaz-coffee");
    expect(input.role).toBeUndefined();
  });

  it("redirects to /login when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      resubmitEmployerOnboardingAction({}, formWith()),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mockResubmit).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request without calling the DAL", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    expect(state.errorCode).toBe("CSRF_REJECTED");
    expect(mockResubmit).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input and does not call the DAL", async () => {
    const state = await resubmitEmployerOnboardingAction(
      {},
      formWith({ organizationSlug: "Bad Slug!" }),
    );
    expect(state.fieldErrors?.organizationSlug).toBeTruthy();
    expect(mockResubmit).not.toHaveBeenCalled();
  });

  it("returns DUPLICATE for a slug already in use", async () => {
    mockResubmit.mockResolvedValue({ ok: false, code: "duplicate" });
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    expect(state.errorCode).toBe("DUPLICATE");
  });

  it("returns NOT_ELIGIBLE when the latest request is not REJECTED", async () => {
    mockResubmit.mockResolvedValue({ ok: false, code: "not_eligible" });
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    expect(state.errorCode).toBe("NOT_ELIGIBLE");
  });

  it("returns a neutral INTERNAL error without leaking details when the DAL throws", async () => {
    mockResubmit.mockRejectedValue(new Error("connection refused"));
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    expect(state.errorCode).toBe("INTERNAL");
    expect(JSON.stringify(state)).not.toContain("connection refused");
  });

  it("rate limits repeated resubmissions for the same user", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(
        resubmitEmployerOnboardingAction({}, formWith()),
      ).rejects.toThrow("REDIRECT:/employer/status");
    }
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    expect(state.errorCode).toBe("RATE_LIMITED");
  });

  it("never leaks the actor identity or pulled data in the state payload", async () => {
    mockResubmit.mockResolvedValue({ ok: false, code: "error" });
    const state = await resubmitEmployerOnboardingAction({}, formWith());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain("almaz-coffee");
  });
});