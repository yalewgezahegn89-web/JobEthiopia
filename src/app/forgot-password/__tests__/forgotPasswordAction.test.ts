import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCsrf: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockForgotRateLimited: vi.fn(),
  mockRequestPasswordReset: vi.fn(),
  mockEqualizeWork: vi.fn(),
  mockDispatch: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  getAppBaseUrl: () => "https://app.test",
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      users: { findFirst: (...a: unknown[]) => mocks.mockUsersFindFirst(...a) },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/db/schema/users", () => ({ users: { id: "id", email: "email", isActive: "isActive" } }));

vi.mock("@/lib/auth/resetPassword", () => ({
  forgotPasswordRateLimited: (e: string) => mocks.mockForgotRateLimited(e),
  requestPasswordReset: (id: string) => mocks.mockRequestPasswordReset(id),
  equalizeUnknownEmailWork: () => mocks.mockEqualizeWork(),
}));

vi.mock("@/lib/email", () => ({
  dispatchPasswordResetEmail: (to: string, url: string) => mocks.mockDispatch(to, url),
}));

import { forgotPasswordAction } from "@/app/forgot-password/actions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";

const initialState = { error: null, success: false };

function formWith(email: string): FormData {
  const form = new FormData();
  form.set("email", email);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitState();
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockForgotRateLimited.mockReturnValue(true);
  mocks.mockEqualizeWork.mockResolvedValue(undefined);
  mocks.mockDispatch.mockResolvedValue(undefined);
});

describe("forgot-password server action", () => {
  it("returns the generic message for an existing active user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, isActive: true });
    mocks.mockRequestPasswordReset.mockResolvedValue({
      rawToken: "raw-token",
      email: EMAIL,
      expiresAt: new Date(),
    });

    const state = await forgotPasswordAction(initialState, formWith(EMAIL));
    expect(state.success).toBe(true);
    expect(state.error).toContain("If an account");
    expect(mocks.mockRequestPasswordReset).toHaveBeenCalledWith(USER_ID);
    expect(mocks.mockDispatch).toHaveBeenCalledTimes(1);
    expect(mocks.mockDispatch.mock.calls[0][0]).toBe(EMAIL);
    expect(mocks.mockDispatch.mock.calls[0][1]).toContain("/reset-password?token=raw-token");
  });

  it("returns the identical generic message for an unknown email and never sends", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);

    const state = await forgotPasswordAction(initialState, formWith("nobody@example.com"));
    expect(state.success).toBe(true);
    expect(state.error).toContain("If an account");
    expect(mocks.mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
    expect(mocks.mockEqualizeWork).toHaveBeenCalled();
  });

  it("returns the identical generic message for an inactive user and never sends", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, isActive: false });

    const state = await forgotPasswordAction(initialState, formWith(EMAIL));
    expect(state.success).toBe(true);
    expect(state.error).toContain("If an account");
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("normalizes email case before rate-limit and lookup", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, isActive: true });
    mocks.mockRequestPasswordReset.mockResolvedValue({
      rawToken: "raw-token",
      email: EMAIL,
      expiresAt: new Date(),
    });

    await forgotPasswordAction(initialState, formWith("  User@Example.COM "));
    expect(mocks.mockUsersFindFirst.mock.calls[0][0].where).toBeDefined();
    expect(mocks.mockForgotRateLimited).toHaveBeenCalledWith(EMAIL);
  });

  it("does not leak which email exists when CSRF fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValueOnce(new CsrfError());

    const state = await forgotPasswordAction(initialState, formWith(EMAIL));
    expect(state.success).toBe(true);
    expect(state.error).toContain("If an account");
  });

  it("rate-limits repeated requests and still returns the generic message", async () => {
    mocks.mockForgotRateLimited.mockReturnValue(false);
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, isActive: true });

    const state = await forgotPasswordAction(initialState, formWith(EMAIL));
    expect(state.success).toBe(true);
    expect(mocks.mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("returns a safe server error when the db throws", async () => {
    mocks.mockUsersFindFirst.mockRejectedValueOnce(new Error("db down"));
    const state = await forgotPasswordAction(initialState, formWith(EMAIL));
    expect(state.success).toBe(false);
    expect(state.error).toBe("Unable to process your request. Please try again.");
  });
});
