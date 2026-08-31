import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

const mocks = vi.hoisted(() => ({
  mockCsrf: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockHashSessionToken: vi.fn(),
  mockChangePassword: vi.fn(),
  mockSessionsFindFirst: vi.fn(),
  mockEq: vi.fn(),
  mockCookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => mocks.mockCookieGet(),
    set: vi.fn(),
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

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/auth/session", () => ({
  hashSessionToken: (...args: unknown[]) => mocks.mockHashSessionToken(...args),
  SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/lib/auth/password", () => ({
  changePassword: (...args: unknown[]) => mocks.mockChangePassword(...args),
  MIN_PASSWORD_LENGTH: 8,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sessions: {
        findFirst: (...args: unknown[]) => mocks.mockSessionsFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/db/schema/sessions", () => ({ sessions: {} }));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => mocks.mockEq(...args),
}));

const mockCsrf = mocks.mockCsrf;
const mockGetCurrentUser = mocks.mockGetCurrentUser;
const mockHashSessionToken = mocks.mockHashSessionToken;
const mockChangePassword = mocks.mockChangePassword;
const mockSessionsFindFirst = mocks.mockSessionsFindFirst;
const mockCookieGet = mocks.mockCookieGet;
const mockEq = mocks.mockEq;

import { changePasswordAction } from "../change-password/actions";
import {
  CHANGE_PASSWORD_SUCCESS,
  CHANGE_PASSWORD_ERROR_CSRF,
  CHANGE_PASSWORD_ERROR_INVALID_CURRENT,
  CHANGE_PASSWORD_ERROR_WEAK,
  CHANGE_PASSWORD_ERROR_RATE_LIMITED,
  CHANGE_PASSWORD_ERROR_SERVER,
  CHANGE_PASSWORD_ERROR_SAME_PASSWORD,
} from "../change-password/types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE = {
  id: USER_ID,
  email: "candidate@example.com",
  name: "Candidate User",
  role: "CANDIDATE",
};
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const RAW_TOKEN = "abc-session-token-123";
const CURRENT_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "NewPassword456";
const CONFIRM_PASSWORD = "NewPassword456";

function formWith(overrides: Record<string, string> = {}): FormData {
  const base = {
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    confirmPassword: CONFIRM_PASSWORD,
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
  mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mockCookieGet.mockReturnValue({ value: RAW_TOKEN });
  mockHashSessionToken.mockReturnValue("hash-of-raw-token");
  mockEq.mockReturnValue("eq-condition");
  mockSessionsFindFirst.mockResolvedValue({ id: SESSION_ID });
  mockChangePassword.mockResolvedValue({ ok: true });
});

afterEach(() => {
  resetRateLimitState();
});

describe("changePasswordAction", () => {
  it("redirects unauthenticated users to /login", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      changePasswordAction({}, formWith()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(
      changePasswordAction({}, formWith()),
    ).rejects.toThrow("REDIRECT:/jobs");
  });

  it("handles CSRF failure safely without calling changePassword", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());
    const state = await changePasswordAction({}, formWith());
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_CSRF);
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("returns a field error when current password is missing", async () => {
    const state = await changePasswordAction(
      {},
      formWith({ currentPassword: "" }),
    );
    expect(state.fieldErrors?.currentPassword).toBeTruthy();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("returns a field error for a short new password", async () => {
    const state = await changePasswordAction(
      {},
      formWith({ newPassword: "short" }),
    );
    expect(state.fieldErrors?.newPassword).toBeTruthy();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("returns a mismatch field error for confirmPassword", async () => {
    const state = await changePasswordAction(
      {},
      formWith({ confirmPassword: "TotallyDifferent" }),
    );
    expect(state.fieldErrors?.confirmPassword).toBeTruthy();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("calls changePassword exactly once on success", async () => {
    const state = await changePasswordAction({}, formWith());
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
    expect(state.success).toBe(CHANGE_PASSWORD_SUCCESS);
  });

  it("returns the exact success message", async () => {
    const state = await changePasswordAction({}, formWith());
    expect(state.success).toBe("Your password has been changed.");
  });

  it("does NOT redirect on success", async () => {
    const state = await changePasswordAction({}, formWith());
    expect(state.success).toBe(CHANGE_PASSWORD_SUCCESS);
    expect(state.formError).toBeUndefined();
  });

  it("maps an invalid current password safely", async () => {
    mockChangePassword.mockResolvedValue({
      ok: false,
      reason: "invalid_current",
    });
    const state = await changePasswordAction({}, formWith());
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_INVALID_CURRENT);
    expect(JSON.stringify(state)).not.toContain("invalid_current");
  });

  it("maps a weak new password safely (defensive fallback)", async () => {
    mockChangePassword.mockResolvedValue({ ok: false, reason: "weak_new" });
    const state = await changePasswordAction({}, formWith());
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_WEAK);
  });

  it("maps an unexpected failure safely without leaking details", async () => {
    mockChangePassword.mockRejectedValue(new Error("connection refused"));
    const state = await changePasswordAction({}, formWith());
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_SERVER);
    expect(JSON.stringify(state)).not.toContain("connection refused");
  });

  it("never passes confirmPassword to changePassword", async () => {
    await changePasswordAction({}, formWith());
    const call = mockChangePassword.mock.calls[0] as unknown as [
      string,
      string,
      string,
      string,
    ];
    // exact call signature: (userId, currentPassword, newPassword, currentSessionId)
    expect(call.length).toBe(4);
    const [, current, newPassword] = call;
    expect(newPassword).toBe(NEW_PASSWORD);
    expect(newPassword).not.toBe(current);
  });

  it("never returns password values in action state", async () => {
    const state = await changePasswordAction({}, formWith());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(CURRENT_PASSWORD);
    expect(serialized).not.toContain(NEW_PASSWORD);
    expect(serialized).not.toContain(CONFIRM_PASSWORD);
  });

  it("passes the current session id to changePassword", async () => {
    await changePasswordAction({}, formWith());
    expect(mockSessionsFindFirst).toHaveBeenCalledTimes(1);
    const [, , , sessionId] = mockChangePassword.mock.calls[0] as unknown as [
      string,
      string,
      string,
      string,
    ];
    expect(sessionId).toBe(SESSION_ID);
  });

  it("uses the user id from the session, never the form", async () => {
    const form = formWith({ userId: "attacker-controlled-id" });
    await changePasswordAction({}, form);
    const [userId] = mockChangePassword.mock.calls[0] as unknown as [string];
    expect(userId).toBe(USER_ID);
  });

  it("ignores role/isActive/passwordHash fields from the form", async () => {
    const form = formWith({
      role: "ADMIN",
      isActive: "true",
      passwordHash: "hunter2",
    });
    const state = await changePasswordAction({}, form);
    expect(state.success).toBe(CHANGE_PASSWORD_SUCCESS);
    expect(mockChangePassword).toHaveBeenCalledWith(
      USER_ID,
      CURRENT_PASSWORD,
      NEW_PASSWORD,
      SESSION_ID,
    );
  });

  it("applies the action-level same-password guard", async () => {
    const state = await changePasswordAction(
      {},
      formWith({ newPassword: CURRENT_PASSWORD, confirmPassword: CURRENT_PASSWORD }),
    );
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_SAME_PASSWORD);
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("rate limits repeat attempts per user", async () => {
    for (let i = 0; i < 5; i++) {
      await changePasswordAction({}, formWith());
    }
    const state = await changePasswordAction({}, formWith());
    expect(state.formError).toBe(CHANGE_PASSWORD_ERROR_RATE_LIMITED);
    expect(mockChangePassword).toHaveBeenCalledTimes(5);
  });

  it("does not leak email, name, or session token in state", async () => {
    const state = await changePasswordAction({}, formWith());
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("candidate@example.com");
    expect(serialized).not.toContain("Candidate User");
    expect(serialized).not.toContain(RAW_TOKEN);
    expect(serialized).not.toContain("hash-of-raw-token");
  });

  it("does not leak a password hash in state", async () => {
    const state = await changePasswordAction({}, formWith());
    expect(JSON.stringify(state)).not.toContain("passwordHash");
  });
});
