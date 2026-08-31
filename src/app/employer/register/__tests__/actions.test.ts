import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCookieStoreSet: vi.fn(),
  mockCsrf: vi.fn(),
  mockSubmit: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: vi.fn(),
    set: mocks.mockCookieStoreSet,
    delete: vi.fn(),
  }),
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

vi.mock("@/lib/employerOnboarding/dal", () => ({
  submitEmployerOnboarding: (...args: unknown[]) => mocks.mockSubmit(...args),
  isDuplicateError: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => mocks.mockCreateSession(...args),
  hashSessionToken: vi.fn(),
}));

const mockCookieStoreSet = mocks.mockCookieStoreSet;
const mockCsrf = mocks.mockCsrf;
const mockSubmit = mocks.mockSubmit;
const mockCreateSession = mocks.mockCreateSession;

import { employerOnboardingAction } from "../actions";
import { EMPLOYER_ONBOARDING_ERROR_NEUTRAL } from "../types";

const RAW_TOKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_0";

function formWith(overrides: Record<string, string> = {}): FormData {
  const base = {
    name: "Almaz Tesfaye",
    email: "almaz@example.com",
    password: "correct-password-123",
    confirmPassword: "correct-password-123",
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
  mockSubmit.mockResolvedValue({
    ok: true,
    userId: "new-user-id",
    requestId: "new-request-id",
  });
  mockCreateSession.mockResolvedValue(RAW_TOKEN);
});

afterEach(() => {
  resetRateLimitState();
});

describe("employer onboarding server action", () => {
  it("creates a session cookie and redirects to /employer/status on success", async () => {
    await expect(
      employerOnboardingAction({ error: null }, formWith()),
    ).rejects.toThrow("REDIRECT:/employer/status");

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledWith("new-user-id");
    expect(mockCookieStoreSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = mockCookieStoreSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("session");
    expect(value).toBe(RAW_TOKEN);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it("returns a neutral duplicate error without revealing account existence", async () => {
    mockSubmit.mockResolvedValue({ ok: false, code: "duplicate" });
    const state = await employerOnboardingAction({ error: null }, formWith());
    expect(state.error).toBe(EMPLOYER_ONBOARDING_ERROR_NEUTRAL);
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a neutral error on a server-side failure", async () => {
    mockSubmit.mockResolvedValue({ ok: false, code: "error" });
    const state = await employerOnboardingAction({ error: null }, formWith());
    expect(state.error).toBe(EMPLOYER_ONBOARDING_ERROR_NEUTRAL);
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a neutral error without a cookie when the DAL throws", async () => {
    mockSubmit.mockRejectedValue(new Error("connection refused"));
    const state = await employerOnboardingAction({ error: null }, formWith());
    expect(state.error).toBe(EMPLOYER_ONBOARDING_ERROR_NEUTRAL);
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("connection refused");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input and does not submit", async () => {
    const state = await employerOnboardingAction(
      { error: null },
      formWith({ email: "not-an-email" }),
    );
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a password mismatch field error", async () => {
    const state = await employerOnboardingAction(
      { error: null },
      formWith({ confirmPassword: "different-password" }),
    );
    expect(state.fieldErrors?.confirmPassword).toBeTruthy();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request without submitting or creating a cookie", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const state = await employerOnboardingAction({ error: null }, formWith());
    expect(state.error).toBe(EMPLOYER_ONBOARDING_ERROR_NEUTRAL);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("rate limits repeated submissions for the same email", async () => {
    // limit is 5 per email per window; the 6th attempt is throttled.
    for (let i = 0; i < 5; i += 1) {
      await expect(employerOnboardingAction({}, formWith())).rejects.toThrow(
        "REDIRECT:/employer/status",
      );
    }
    const state = await employerOnboardingAction({}, formWith());
    expect(state.error).toBe(EMPLOYER_ONBOARDING_ERROR_NEUTRAL);
  });

  it("returns only neutral error with no PII/password in the payload", async () => {
    mockSubmit.mockResolvedValue({ ok: false, code: "error" });
    const state = await employerOnboardingAction({ error: null }, formWith());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("almaz@example.com");
    expect(serialized).not.toContain("correct-password-123");
    expect(serialized).not.toContain("Almaz");
    expect(serialized).not.toContain("almaz-coffee");
  });
});
