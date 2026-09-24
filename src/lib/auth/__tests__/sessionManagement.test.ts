import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSessionsFindMany: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sessions: {
          findMany: (...args: unknown[]) => mocks.mockSessionsFindMany(...args),
        },
      },
      delete: mocks.mockDelete,
    },
  };
});

const mockSessionsFindMany = mocks.mockSessionsFindMany;
const mockDelete = mocks.mockDelete;

import {
  listSessionsForUser,
  revokeSessionById,
} from "../session";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

const ROW = {
  id: SESSION_ID,
  userId: USER_ID,
  createdAt: new Date("2026-01-01T10:00:00Z"),
  expiresAt: new Date("2026-01-08T10:00:00Z"),
  lastUsedAt: new Date("2026-01-02T10:00:00Z"),
};

const deleteWhereReturning = (rows: { id: string }[]) =>
  ({
    where: () => ({
      returning: async () => rows,
    }),
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockDelete.mockImplementation(() => ({
    where: () => ({
      returning: async () => [],
    }),
  }));
});

describe("session management", () => {
  it("lists a user's sessions mapped to the UI shape", async () => {
    mockSessionsFindMany.mockResolvedValue([ROW, { ...ROW, id: "other" }]);

    const rows = await listSessionsForUser(USER_ID);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: SESSION_ID,
      createdAt: ROW.createdAt,
      expiresAt: ROW.expiresAt,
      lastUsedAt: ROW.lastUsedAt,
    });
    expect(mockSessionsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
        columns: expect.objectContaining({ id: true, lastUsedAt: true }),
      }),
    );
  });

  it("returns an empty list when the user has no sessions", async () => {
    mockSessionsFindMany.mockResolvedValue([]);
    expect(await listSessionsForUser(USER_ID)).toEqual([]);
  });

  it("revokes a session and reports success", async () => {
    mockDelete.mockImplementation(
      () => deleteWhereReturning([{ id: SESSION_ID }]) as never,
    );

    const revoked = await revokeSessionById(SESSION_ID, USER_ID);
    expect(revoked).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("reports no-op when the session does not exist", async () => {
    mockDelete.mockImplementation(
      () => deleteWhereReturning([]) as never,
    );

    expect(await revokeSessionById(SESSION_ID, USER_ID)).toBe(false);
  });

  it("refuses empty session id or user id", async () => {
    expect(await revokeSessionById("", USER_ID)).toBe(false);
    expect(await revokeSessionById(SESSION_ID, "")).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});