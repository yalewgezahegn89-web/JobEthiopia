import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCookieStoreSet: vi.fn(),
  mockCsrf: vi.fn(),
  mockRegisterCandidate: vi.fn(),
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

vi.mock("@/lib/register/dal", () => ({
  registerCandidate: (...args: unknown[]) => mocks.mockRegisterCandidate(...args),
  isDuplicateError: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => mocks.mockCreateSession(...args),
  hashSessionToken: vi.fn(),
}));

const mockCookieStoreSet = mocks.mockCookieStoreSet;
const mockCsrf = mocks.mockCsrf;
const mockRegisterCandidate = mocks.mockRegisterCandidate;
const mockCreateSession = mocks.mockCreateSession;

import { registerAction } from "../actions";
import { REGISTER_ERROR_NEUTRAL } from "../types";

const RAW_TOKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_0";

function formWith(overrides: Record<string, string> = {}): FormData {
  const base = {
    name: "Almaz Tesfaye",
    email: "almaz@example.com",
    password: "correct-password-123",
    confirmPassword: "correct-password-123",
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
  mockRegisterCandidate.mockResolvedValue({ ok: true, userId: "new-user-id" });
  mockCreateSession.mockResolvedValue(RAW_TOKEN);
});

afterEach(() => {
  resetRateLimitState();
});

describe("register server action", () => {
  it("creates a session cookie and redirects to /jobs on success", async () => {
    await expect(
      registerAction({ error: null }, formWith()),
    ).rejects.toThrow("REDIRECT:/jobs");

    expect(mockRegisterCandidate).toHaveBeenCalledTimes(1);
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
    mockRegisterCandidate.mockResolvedValue({ ok: false, code: "duplicate" });
    const state = await registerAction({ error: null }, formWith());
    expect(state.error).toBe(REGISTER_ERROR_NEUTRAL);
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a neutral error on a server-side failure", async () => {
    mockRegisterCandidate.mockResolvedValue({ ok: false, code: "error" });
    const state = await registerAction({ error: null }, formWith());
    expect(state.error).toBe(REGISTER_ERROR_NEUTRAL);
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a neutral error without a cookie when the DAL throws", async () => {
    mockRegisterCandidate.mockRejectedValue(new Error("connection refused"));
    const state = await registerAction({ error: null }, formWith());
    expect(state.error).toBe(REGISTER_ERROR_NEUTRAL);
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("connection refused");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input and does not create an account", async () => {
    const state = await registerAction(
      { error: null },
      formWith({ email: "not-an-email" }),
    );
    expect(state.fieldErrors?.email).toBeTruthy();
    expect(mockRegisterCandidate).not.toHaveBeenCalled();
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a password mismatch field error", async () => {
    const state = await registerAction(
      { error: null },
      formWith({ confirmPassword: "different-password" }),
    );
    expect(state.fieldErrors?.confirmPassword).toBeTruthy();
    expect(mockRegisterCandidate).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request without creating an account or cookie", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const state = await registerAction({ error: null }, formWith());
    expect(state.error).toBe(REGISTER_ERROR_NEUTRAL);
    expect(mockRegisterCandidate).not.toHaveBeenCalled();
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("rate limits repeated registrations for the same email", async () => {
    // limit is 3 per email per window; the 4th attempt is throttled.
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    const state = await registerAction({}, formWith());
    expect(state.error).toBe(REGISTER_ERROR_NEUTRAL);
  });

  it("rate limiting registration does not affect the login bucket", async () => {
    const { checkRateLimit } = await import("@/lib/rateLimit");
    // consume all registration slots for this email
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    await expect(registerAction({}, formWith())).rejects.toThrow("REDIRECT:/jobs");
    // a distinct login key remains allowed
    expect(checkRateLimit("login:127.0.0.1", { limit: 5, windowMs: 15 * 60_000 }).allowed).toBe(true);
  });

  it("returns only neutral error with no PII/password in the payload", async () => {
    mockRegisterCandidate.mockResolvedValue({ ok: false, code: "error" });
    const state = await registerAction({ error: null }, formWith());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("almaz@example.com");
    expect(serialized).not.toContain("correct-password-123");
    expect(serialized).not.toContain("Almaz");
  });
});
