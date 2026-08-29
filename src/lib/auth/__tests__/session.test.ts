import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSessionsFindFirst: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdateSet: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockSelectRows: vi.fn(),
}));

const capturedSessionValues: Record<string, unknown>[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sessions: {
          findFirst: (...args: unknown[]) => mocks.mockSessionsFindFirst(...args),
        },
        users: {
          findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
        },
      },
      insert: mocks.mockInsert,
      update: mocks.mockUpdateSet,
      delete: mocks.mockDeleteWhere,
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => mocks.mockSelectRows(),
          }),
        }),
      }),
    },
  };
});

const mockSessionsFindFirst = mocks.mockSessionsFindFirst;
const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockInsert = mocks.mockInsert;
const mockUpdateSet = mocks.mockUpdateSet;
const mockDeleteWhere = mocks.mockDeleteWhere;
const mockSelectRows = mocks.mockSelectRows;

import {
  createSession,
  verifySession,
  revokeSession,
  hashSessionToken,
} from "../session";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Administrator",
  role: "SUPER_ADMIN",
  isActive: true,
};

const SESSION_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: USER.id,
  tokenHash: "abcd",
  expiresAt: new Date(Date.now() + 1000 * 60),
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedSessionValues.length = 0;

  mockInsert.mockImplementation(() => ({
    values: async (values: Record<string, unknown>) => {
      capturedSessionValues.push(values);
      return [{ ...values, id: "new-id" }];
    },
  }));

  mockUpdateSet.mockImplementation(() => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }));

  mockDeleteWhere.mockImplementation(() => ({
    where: () => Promise.resolve(),
  }));
});

describe("session", () => {
  it("creates a cryptographically random raw token", async () => {
    const token = await createSession(USER.id);
    expect(token).toBeTruthy();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("persists a hash, not the raw token, and expires in the future", async () => {
    const token = await createSession(USER.id);
    expect(capturedSessionValues).toHaveLength(1);
    const stored = capturedSessionValues[0];
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toBe(hashSessionToken(token));
    expect(stored.userId).toBe(USER.id);
    expect(new Date(stored.expiresAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("resolves a valid session to the authenticated user", async () => {
    const token = await createSession(USER.id);
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(USER);

    const user = await verifySession(token);
    expect(user).toEqual({
      id: USER.id,
      email: USER.email,
      name: USER.name,
      role: USER.role,
    });
  });

  it("updates lastUsedAt on successful verification", async () => {
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(USER);

    await verifySession("some-raw-token");
    expect(mockUpdateSet).toHaveBeenCalled();
  });

  it("rejects an expired session", async () => {
    mockSessionsFindFirst.mockResolvedValue(null);
    mockUsersFindFirst.mockResolvedValue(USER);

    const user = await verifySession("expired-token");
    expect(user).toBeNull();
  });

  it("rejects an unknown/revoked token", async () => {
    mockSessionsFindFirst.mockResolvedValue(null);
    const user = await verifySession("never-existed-token");
    expect(user).toBeNull();
  });

  it("rejects a missing or empty token", async () => {
    expect(await verifySession("")).toBeNull();
    expect(mockSessionsFindFirst).not.toHaveBeenCalled();
  });

  it("rejects an inactive user and revokes the session", async () => {
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue({ ...USER, isActive: false });

    const user = await verifySession("token-for-inactive");
    expect(user).toBeNull();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("rejects a session whose user went missing and revokes it", async () => {
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(undefined);

    const user = await verifySession("token-for-missing-user");
    expect(user).toBeNull();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("still resolves the user when the lastUsedAt update fails", async () => {
    mockSessionsFindFirst.mockResolvedValue(SESSION_ROW);
    mockUsersFindFirst.mockResolvedValue(USER);
    mockUpdateSet.mockImplementation(() => ({
      set: () => ({
        where: () => Promise.reject(new Error("db down")),
      }),
    }));

    const user = await verifySession("token-despite-update-failure");
    expect(user).toEqual(expect.objectContaining({ id: USER.id }));
  });

  it("revokes an existing session and returns the user id", async () => {
    mockSelectRows.mockResolvedValue([SESSION_ROW]);
    const userId = await revokeSession("raw-token-to-revoke");
    expect(userId).toBe(USER.id);
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("returns null when revoking a session that does not exist", async () => {
    mockSelectRows.mockResolvedValue([]);
    expect(await revokeSession("ghost-token")).toBeNull();
  });

  it("is safe to revoke with an empty token", async () => {
    expect(await revokeSession("")).toBeNull();
    expect(mockSelectRows).not.toHaveBeenCalled();
  });
});