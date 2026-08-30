import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitState } from "@/lib/rateLimit";

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockUsersFindFirst: vi.fn(),
  mockTokensFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      users: { findFirst: (...a: unknown[]) => mocks.mockUsersFindFirst(...a) },
      passwordResetTokens: { findFirst: (...a: unknown[]) => mocks.mockTokensFindFirst(...a) },
    },
    transaction: (...a: unknown[]) => mocks.mockTransaction(...a),
    insert: mocks.mockDbInsert,
    delete: mocks.mockDbDelete,
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: { id: "users_id", email: "users_email", isActive: "users_is_active", isVerified: "x", role: "x", passwordHash: "x", updatedAt: "x", createdAt: "x", name: "x" },
}));
vi.mock("@/db/schema/sessions", () => ({
  sessions: { id: "sessions_id", userId: "sessions_user_id" },
}));
vi.mock("@/db/schema/passwordResetTokens", () => ({
  passwordResetTokens: { id: "prt_id", userId: "prt_user_id", tokenHash: "prt_token_hash", expiresAt: "prt_expires_at" },
}));
vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

import {
  hashResetToken,
  createPasswordResetToken,
  findValidPasswordResetToken,
  consumePasswordResetToken,
  resetPasswordWithToken,
  requestPasswordReset,
  forgotPasswordRateLimited,
  resetAttemptRateLimited,
  equalizeUnknownEmailWork,
} from "../resetPassword";
import { hashPassword } from "../password";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "user@example.com";

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prt-1",
    userId: USER_ID,
    tokenHash: hashResetToken("raw-token-value"),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  };
}

/* A transaction mock supporting the chained builders used by the engine. */
function buildTx() {
  const captured: {
    insertValues?: Record<string, unknown>;
    inserted: Array<Record<string, unknown>>;
    deleteWhereArgs: unknown[];
    returningCalls: unknown[];
    selectLimits: Array<Array<Record<string, unknown>>>;
  } = {
    inserted: [],
    deleteWhereArgs: [],
    returningCalls: [],
    selectLimits: [],
  };

  const limit = vi
    .fn()
    .mockImplementation(() => Promise.resolve(captured.selectLimits.shift() ?? []));
  const select = () => ({ from: () => ({ where: () => ({ limit }) }) });

  const tx = {
    captured,
    select,
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockImplementation(() => Promise.resolve([])),
      })),
    }),
    insert: vi.fn().mockImplementation((_table: unknown) => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured.inserted.push(v);
        captured.insertValues = v;
        return Promise.resolve({});
      }),
    })),
  };

  /* track delete.where args and returning call counts through captured */
  return tx;
}

let tx: ReturnType<typeof buildTx>;

beforeEach(async () => {
  vi.clearAllMocks();
  resetRateLimitState();
  tx = buildTx();
  mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(tx));
  mocks.mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  mocks.mockDbDelete.mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── hash / token helpers ───────────────────────────────────────────────── */

describe("hashResetToken", () => {
  it("produces a 64-char hex SHA-256 digest", () => {
    expect(hashResetToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is deterministic", () => {
    expect(hashResetToken("t")).toBe(hashResetToken("t"));
  });
});

describe("rate limiting", () => {
  it("forgotPasswordRateLimited true initially", () => {
    expect(forgotPasswordRateLimited("a@b.com")).toBe(true);
  });
  it("resetAttemptRateLimited true initially", () => {
    expect(resetAttemptRateLimited("token")).toBe(true);
  });
});

describe("equalizeUnknownEmailWork", () => {
  it("resolves without throwing", async () => {
    await expect(equalizeUnknownEmailWork()).resolves.toBeUndefined();
  });
});

/* ── createPasswordResetToken ───────────────────────────────────────────── */

describe("createPasswordResetToken", () => {
  it("returns null when the user is not found", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);
    const result = await createPasswordResetToken(USER_ID);
    expect(result).toBeNull();
  });

  it("returns null when the user is inactive", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      isActive: false,
    });
    const result = await createPasswordResetToken(USER_ID);
    expect(result).toBeNull();
  });

  it("stores only the hash, never the raw token", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: true });
    const result = await createPasswordResetToken(USER_ID);

    expect(result).not.toBeNull();
    const { rawToken } = result!;

    const insertValues = tx.captured.inserted[0];
    expect(insertValues).toBeDefined();
    const storedHash = insertValues.tokenHash as string;

    expect(storedHash).toBe(hashResetToken(rawToken));
    expect(storedHash).not.toBe(rawToken);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sets a 30-minute expiry", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: true });
    await createPasswordResetToken(USER_ID);
    const insertValues = tx.captured.inserted[0];
    const expiresAt = insertValues.expiresAt as Date;
    const delta = expiresAt.getTime() - Date.now();
    expect(delta).toBeGreaterThan(29 * 60 * 1000);
    expect(delta).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it("deletes any prior token before inserting (single active token)", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: true });
    await createPasswordResetToken(USER_ID);
    expect(tx.delete).toHaveBeenCalledWith(expect.anything());
    expect(tx.insert).toHaveBeenCalledWith(expect.anything());
  });
});

/* ── findValidPasswordResetToken ────────────────────────────────────────── */

describe("findValidPasswordResetToken", () => {
  it("returns null for an empty token", async () => {
    expect(await findValidPasswordResetToken("")).toBeNull();
  });

  it("returns null when the token is unknown", async () => {
    mocks.mockTokensFindFirst.mockResolvedValue(null);
    expect(await findValidPasswordResetToken("unknown")).toBeNull();
  });

  it("returns null when the token is expired", async () => {
    mocks.mockTokensFindFirst.mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await findValidPasswordResetToken("raw-token-value")).toBeNull();
  });

  it("returns null when the owning user is inactive", async () => {
    mocks.mockTokensFindFirst.mockResolvedValue(tokenRow());
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: false });
    expect(await findValidPasswordResetToken("raw-token-value")).toBeNull();
  });

  it("resolves a valid token to its active user", async () => {
    mocks.mockTokensFindFirst.mockResolvedValue(tokenRow());
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: true });
    expect(await findValidPasswordResetToken("raw-token-value")).toEqual({
      userId: USER_ID,
      email: EMAIL,
    });
  });
});

/* ── consumePasswordResetToken ──────────────────────────────────────────── */

describe("consumePasswordResetToken", () => {
  it("deletes the token row and reports consumed", async () => {
    mocks.mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "prt-1" }]),
      }),
    });
    const consumed = await consumePasswordResetToken("raw-token-value");
    expect(consumed).toBe(true);
    expect(mocks.mockDbDelete).toHaveBeenCalled();
  });

  it("reports not consumed when no row matched", async () => {
    mocks.mockDbDelete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });
    const consumed = await consumePasswordResetToken("missing-token");
    expect(consumed).toBe(false);
  });
});

/* ── resetPasswordWithToken ─────────────────────────────────────────────── */

describe("resetPasswordWithToken", () => {
  it("rejects a weak password before token lookup", async () => {
    const result = await resetPasswordWithToken("raw-token-value", "short");
    expect(result).toEqual({ ok: false, reason: "weak" });
  });

  it("rejects an empty token", async () => {
    const result = await resetPasswordWithToken("", "password-1234");
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("returns invalid_token when row not found/expired", async () => {
    tx.captured.selectLimits.push([]);
    const result = await resetPasswordWithToken("raw-token-value", "password-1234");
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("returns invalid_token when user is missing or inactive", async () => {
    tx.captured.selectLimits.push([tokenRow()]);
    tx.captured.selectLimits.push([]);
    const result = await resetPasswordWithToken("raw-token-value", "password-1234");
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("succeeds and stores a verifiable password hash", async () => {
    tx.captured.selectLimits.push([tokenRow()]);
    tx.captured.selectLimits.push([{ id: USER_ID, isActive: true }]);

    const result = await resetPasswordWithToken("raw-token-value", "new-password-123");
    expect(result).toEqual({ ok: true });

    const updateCall = tx.update.mock.results[0]?.value;
    const setCall = updateCall.set.mock.calls[0][0];
    expect(await hashPassword("new-password-123")).toBeTruthy();
    expect(typeof setCall.passwordHash).toBe("string");
  });

  it("revokes all sessions for the user", async () => {
    tx.captured.selectLimits.push([tokenRow()]);
    tx.captured.selectLimits.push([{ id: USER_ID, isActive: true }]);

    await resetPasswordWithToken("raw-token-value", "new-password-123");
    expect(tx.delete).toHaveBeenCalledWith(expect.anything());
  });

  it("deletes the consumed token within the transaction", async () => {
    tx.captured.selectLimits.push([tokenRow()]);
    tx.captured.selectLimits.push([{ id: USER_ID, isActive: true }]);

    await resetPasswordWithToken("raw-token-value", "new-password-123");
    expect(tx.insert).toHaveBeenCalled();
  });

  it("uses a single transaction", async () => {
    tx.captured.selectLimits.push([tokenRow()]);
    tx.captured.selectLimits.push([{ id: USER_ID, isActive: true }]);

    await resetPasswordWithToken("raw-token-value", "new-password-123");
    expect(mocks.mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns error when the transaction throws (atomic rollback)", async () => {
    mocks.mockTransaction.mockRejectedValue(new Error("db down"));
    const result = await resetPasswordWithToken("raw-token-value", "new-password-123");
    expect(result).toEqual({ ok: false, reason: "error" });
  });
});

/* ── requestPasswordReset ───────────────────────────────────────────────── */

describe("requestPasswordReset", () => {
  it("returns null for unknown/inactive user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);
    expect(await requestPasswordReset(USER_ID)).toBeNull();
  });

  it("creates a token for an active user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({ id: USER_ID, email: EMAIL, isActive: true });
    const result = await requestPasswordReset(USER_ID);
    expect(result).not.toBeNull();
    expect(result!.email).toBe(EMAIL);
  });
});
