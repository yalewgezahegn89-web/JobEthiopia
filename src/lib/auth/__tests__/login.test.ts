import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUsersFindFirst: vi.fn(),
  mockInsert: vi.fn(),
}));

const capturedDbWrites: { table: string; values: Record<string, unknown> }[] =
  [];

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

const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockInsert = mocks.mockInsert;

import { loginUser, normalizeEmail } from "../login";
import { hashPassword } from "../password";

let hash: string;

const ACTIVE_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Administrator",
  role: "SUPER_ADMIN",
  isActive: true,
  passwordHash: "",
};

beforeAll(async () => {
  hash = await hashPassword("correct-password-123");
});

beforeEach(() => {
  vi.clearAllMocks();
  capturedDbWrites.length = 0;
  mockUsersFindFirst.mockResolvedValue(undefined);

  mockInsert.mockImplementation((table: unknown) => ({
    values: async (values: Record<string, unknown>) => {
      capturedDbWrites.push({ table: String(table), values });
      return [{ ...values, id: "new-id" }];
    },
  }));
});

describe("loginUser", () => {
  it("succeeds with valid credentials and creates a session", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      passwordHash: hash,
    });

    const result = await loginUser("  Admin@Example.com ", "correct-password-123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(ACTIVE_USER.id);
      expect(result.userEmail).toBe(ACTIVE_USER.email);
      expect(result.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("records LOGIN_SUCCESS on success", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      passwordHash: hash,
    });
    await loginUser("admin@example.com", "correct-password-123");

    const audit = capturedDbWrites.find(
      (w) => (w.values.action as string) === "LOGIN_SUCCESS",
    );
    expect(audit).toBeTruthy();
    expect(audit!.values.actorUserId).toBe(ACTIVE_USER.id);
  });

  it("rejects a wrong password without exposing why", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      passwordHash: hash,
    });

    const result = await loginUser("admin@example.com", "wrong-password");
    expect(result).toEqual({ ok: false });
  });

  it("does not create a session on a wrong password", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      passwordHash: hash,
    });
    await loginUser("admin@example.com", "wrong-password");

    const sessions = capturedDbWrites.filter(
      (w) => (w.values.userId as string) === ACTIVE_USER.id && !("action" in w.values),
    );
    expect(sessions).toHaveLength(0);
  });

  it("rejects an inactive user", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      isActive: false,
      passwordHash: hash,
    });

    const result = await loginUser("admin@example.com", "correct-password-123");
    expect(result).toEqual({ ok: false });
  });

  it("rejects an unknown email and records failure with a null actor", async () => {
    const result = await loginUser("nobody@example.com", "anything-password");
    expect(result).toEqual({ ok: false });

    const failure = capturedDbWrites.find(
      (w) => (w.values.action as string) === "LOGIN_FAILURE",
    );
    expect(failure).toBeTruthy();
    expect(failure!.values.actorUserId).toBeNull();
  });

  it("returns a generic failure for empty input without touching the db", async () => {
    const result = await loginUser("", "");
    expect(result).toEqual({ ok: false });
    expect(mockUsersFindFirst).not.toHaveBeenCalled();
    expect(capturedDbWrites).toHaveLength(0);
  });

  it("does not store secrets in audit metadata", async () => {
    mockUsersFindFirst.mockResolvedValue({
      ...ACTIVE_USER,
      passwordHash: hash,
    });
    await loginUser("admin@example.com", "wrong-password");

    const failure = capturedDbWrites.find(
      (w) => (w.values.action as string) === "LOGIN_FAILURE",
    );
    const serialized = JSON.stringify(failure!.values);
    expect(serialized).not.toContain("wrong-password");
    expect(serialized).not.toContain(hash);
  });

  it("normalizes emails to lowercase", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });
});