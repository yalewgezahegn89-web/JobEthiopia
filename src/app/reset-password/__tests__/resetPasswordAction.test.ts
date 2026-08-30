import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCsrf: vi.fn(),
  mockResetRateLimited: vi.fn(),
  mockFindValid: vi.fn(),
  mockResetWithToken: vi.fn(),
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

vi.mock("@/lib/auth/resetPassword", () => ({
  resetAttemptRateLimited: (t: string) => mocks.mockResetRateLimited(t),
  findValidPasswordResetToken: (t: string) => mocks.mockFindValid(t),
  resetPasswordWithToken: (t: string, p: string) => mocks.mockResetWithToken(t, p),
}));

import { resetPasswordAction } from "@/app/reset-password/actions";

const initialState = { error: null };

function formWith(token: string, password: string): FormData {
  const form = new FormData();
  form.set("token", token);
  form.set("password", password);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitState();
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockResetRateLimited.mockReturnValue(true);
  mocks.mockFindValid.mockResolvedValue({ userId: "u-1", email: "u@example.com" });
  mocks.mockResetWithToken.mockResolvedValue({ ok: true });
});

describe("reset-password server action", () => {
  it("redirects to /login on success", async () => {
    await expect(
      resetPasswordAction(initialState, formWith("raw-token", "new-password-123")),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockResetWithToken).toHaveBeenCalledWith("raw-token", "new-password-123");
  });

  it("returns a generic invalid-token error when the token is missing", async () => {
    const state = await resetPasswordAction(initialState, formWith("", "new-password-123"));
    expect(state.error).toBe("This reset link is invalid or has expired.");
    expect(mocks.mockResetWithToken).not.toHaveBeenCalled();
  });

  it("returns a generic invalid-token error when the token is invalid/expired", async () => {
    mocks.mockFindValid.mockResolvedValue(null);
    const state = await resetPasswordAction(initialState, formWith("bad", "new-password-123"));
    expect(state.error).toBe("This reset link is invalid or has expired.");
    expect(mocks.mockResetWithToken).not.toHaveBeenCalled();
  });

  it("rejects a too-short password", async () => {
    const state = await resetPasswordAction(initialState, formWith("raw-token", "short"));
    expect(state.error).toBe("Password must be at least 8 characters.");
    expect(mocks.mockResetWithToken).not.toHaveBeenCalled();
  });

  it("returns a safe server error when the reset fails", async () => {
    mocks.mockResetWithToken.mockResolvedValue({ ok: false, reason: "error" });
    const state = await resetPasswordAction(initialState, formWith("raw-token", "new-password-123"));
    expect(state.error).toBe("Something went wrong. Please try again.");
  });

  it("does not leak the token in any error response", async () => {
    mocks.mockResetWithToken.mockResolvedValue({ ok: false, reason: "error" });
    const state = await resetPasswordAction(initialState, formWith("raw-secret-token", "new-password-123"));
    expect(JSON.stringify(state)).not.toContain("raw-secret-token");
  });

  it("returns invalid-token error when CSRF fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValueOnce(new CsrfError());
    const state = await resetPasswordAction(initialState, formWith("raw-token", "new-password-123"));
    expect(state.error).toBe("This reset link is invalid or has expired.");
  });

  it("rate-limits repeated attempts on the same token hash", async () => {
    mocks.mockResetRateLimited.mockReturnValue(false);
    const state = await resetPasswordAction(initialState, formWith("raw-token", "new-password-123"));
    expect(state.error).toBe("This reset link is invalid or has expired.");
    expect(mocks.mockFindValid).not.toHaveBeenCalled();
  });
});
