import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieStoreSet: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockInsert: vi.fn(),
  mockCsrf: vi.fn(),
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

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        users: {
          findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
        },
        sessions: {
          findFirst: vi.fn(),
        },
      },
      insert: mocks.mockInsert,
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
    },
  };
});

const mockCookieStoreSet = mocks.mockCookieStoreSet;
const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockInsert = mocks.mockInsert;
const mockCsrf = mocks.mockCsrf;

import { loginAction } from "@/app/login/actions";
import { hashPassword } from "../password";

let hash: string;
const USER = {
  id: "u-1",
  email: "admin@example.com",
  name: "Administrator",
  role: "SUPER_ADMIN",
  isActive: true,
};

function formWith(email: string, password: string): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

beforeAll(async () => {
  hash = await hashPassword("correct-password-123");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCsrf.mockResolvedValue(true);
  mockInsert.mockImplementation(() => ({
    values: async (values: Record<string, unknown>) => [
      { ...values, id: "new-id" },
    ],
  }));
  mockUsersFindFirst.mockResolvedValue({ ...USER, passwordHash: hash });
});

describe("login server action", () => {
  it("sets an HttpOnly SameSite=Lax session cookie on success and redirects to /admin", async () => {
    await expect(
      loginAction({ error: null }, formWith("admin@example.com", "correct-password-123")),
    ).rejects.toThrow("REDIRECT:/admin");

    expect(mockCookieStoreSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = mockCookieStoreSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("session");
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it("does not leak raw tokens to the client beyond the cookie (no redirect on failure)", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...USER,
      passwordHash: "scrypt$0$0$0$00$00",
    });
    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "wrong-password"),
    );
    expect(state.error).toBe("Invalid email or password");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a generic failure for inactive users without a cookie", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...USER,
      isActive: false,
      passwordHash: hash,
    });
    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "correct-password-123"),
    );
    expect(state.error).toBe("Invalid email or password");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a safe server error instead of a stack trace when the db fails", async () => {
    mockUsersFindFirst.mockRejectedValueOnce(new Error("connection refused"));
    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "correct-password-123"),
    );
    expect(state.error).toBe("Unable to sign in. Please try again.");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("never exposes the password hash through the response", async () => {
    mockUsersFindFirst.mockResolvedValue({ ...USER, passwordHash: hash });
    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "wrong-password"),
    );
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(hash);
    expect(serialized).not.toContain("wrong-password");
  });

  it("returns a generic error for a cross-origin request without setting a cookie", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());

    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "correct-password-123"),
    );

    expect(state.error).toBe("Invalid email or password");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("returns a generic error when the origin is missing", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mockCsrf.mockRejectedValueOnce(new CsrfError());

    const state = await loginAction(
      { error: null },
      formWith("admin@example.com", "correct-password-123"),
    );

    expect(state.error).toBe("Invalid email or password");
    expect(mockCookieStoreSet).not.toHaveBeenCalled();
  });

  it("continues the normal flow when the request origin is trusted", async () => {
    await expect(
      loginAction(
        { error: null },
        formWith("admin@example.com", "correct-password-123"),
      ),
    ).rejects.toThrow("REDIRECT:/admin");

    expect(mockCsrf).toHaveBeenCalledTimes(1);
    expect(mockCookieStoreSet).toHaveBeenCalledTimes(1);
  });
});
