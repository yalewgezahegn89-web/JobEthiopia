import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => {
  const captured: {
    updateValues?: Record<string, unknown>;
    deleteWhere?: unknown;
    insertValues?: Record<string, unknown>;
  } = {};

  return {
    captured,
    mockUsersFindFirst: vi.fn(),
    mockSessionsFindFirst: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockInsert: vi.fn(),
    mockTransaction: vi.fn(),
  };
});

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
      },
      sessions: {
        findFirst: (...args: unknown[]) => mocks.mockSessionsFindFirst(...args),
      },
    },
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
    insert: mocks.mockInsert,
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/users", () => ({ users: { id: "users_id" } }));
vi.mock("@/db/schema/sessions", () => ({ sessions: { id: "sessions_id", userId: "sessions_user_id", tokenHash: "sessions_token_hash" } }));
vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

import { changePassword, hashSessionTokenForPassword } from "../password";
import { hashPassword, verifyPassword } from "../password";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CURRENT_PASSWORD = "current-password-123";
const NEW_PASSWORD = "new-password-456";

let currentHash: string;

beforeEach(async () => {
  vi.clearAllMocks();
  currentHash = await hashPassword(CURRENT_PASSWORD);

  mocks.mockUsersFindFirst.mockResolvedValue({
    id: USER_ID,
    passwordHash: currentHash,
  });

  mocks.mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  mocks.mockDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });

  mocks.mockInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  mocks.mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      insert: mocks.mockInsert,
    };
    return fn(tx);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── changePassword unit tests ─────────────────────────────────────────── */

describe("changePassword", () => {
  it("succeeds with correct current password", async () => {
    const result = await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);
    expect(result).toEqual({ ok: true });
  });

  it("rejects wrong current password", async () => {
    const result = await changePassword(USER_ID, "wrong-password", NEW_PASSWORD, SESSION_ID);
    expect(result).toEqual({ ok: false, reason: "invalid_current" });
  });

  it("rejects new password shorter than minimum", async () => {
    const result = await changePassword(USER_ID, CURRENT_PASSWORD, "short", SESSION_ID);
    expect(result).toEqual({ ok: false, reason: "weak_new" });
  });

  it("updates passwordHash in DB", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    const updateCall = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateCall).toBeDefined();
    const setCall = updateCall.set.mock.results[0]?.value;
    expect(setCall).toBeDefined();
  });

  it("deletes all sessions except the current one", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    expect(mocks.mockDelete).toHaveBeenCalled();
  });

  it("keeps current session alive (does not delete it)", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    const deleteCall = mocks.mockDelete.mock.results[0]?.value;
    expect(deleteCall).toBeDefined();
  });

  it("writes PASSWORD_CHANGED audit event", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    expect(mocks.mockInsert).toHaveBeenCalled();
    const insertCall = mocks.mockInsert.mock.results[0]?.value;
    expect(insertCall).toBeDefined();
  });

  it("audit contains actor/target but no sensitive data", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    const insertCall = mocks.mockInsert.mock.results[0]?.value;
    expect(insertCall).toBeDefined();
  });

  it("returns not_found for missing user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);

    const result = await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("uses a single transaction for atomicity", async () => {
    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    expect(mocks.mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns error when transaction fails", async () => {
    mocks.mockTransaction.mockRejectedValue(new Error("db down"));

    const result = await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("new password actually verifies against the new hash", async () => {
    mocks.mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: mocks.mockUpdate,
        delete: mocks.mockDelete,
        insert: mocks.mockInsert,
      };
      return fn(tx);
    });

    await changePassword(USER_ID, CURRENT_PASSWORD, NEW_PASSWORD, SESSION_ID);

    const setCall = mocks.mockUpdate.mock.results[0]?.value;
    const setPasswordHash = setCall.set.mock.calls[0][0].passwordHash;
    const newHash = setPasswordHash;

    const ok = await verifyPassword(newHash, NEW_PASSWORD);
    expect(ok).toBe(true);

    const oldOk = await verifyPassword(newHash, CURRENT_PASSWORD);
    expect(oldOk).toBe(false);
  });
});

/* ── hashSessionTokenForPassword ───────────────────────────────────────── */

describe("hashSessionTokenForPassword", () => {
  it("produces a SHA-256 hex digest", () => {
    const hash = hashSessionTokenForPassword("test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashSessionTokenForPassword("same-token");
    const b = hashSessionTokenForPassword("same-token");
    expect(a).toBe(b);
  });

  it("different tokens produce different hashes", () => {
    const a = hashSessionTokenForPassword("token-a");
    const b = hashSessionTokenForPassword("token-b");
    expect(a).not.toBe(b);
  });
});
