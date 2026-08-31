import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "users_id",
    email: "users_email",
    name: "users_name",
    passwordHash: "users_password_hash",
    role: "users_role",
    isActive: "users_is_active",
  },
}));

vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

import { registerCandidate, isDuplicateError } from "../dal";

interface TxCapture {
  userWrite?: Record<string, unknown>;
  auditWrite?: Record<string, unknown>;
  userInsertError?: unknown;
}

function buildTx(capture: TxCapture) {
  const tx = {
    insert: vi.fn().mockImplementation(() => {
      const onUser =
        capture.userInsertError !== undefined &&
        (() => {
          throw capture.userInsertError;
        });
      return {
        values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
          if (onUser) {
            capture.userWrite = values;
            // reject synchronously so the caller's transaction catches it
            return {
              returning: () =>
                Promise.reject(capture.userInsertError),
            };
          }
          if (values.action) {
            capture.auditWrite = values;
            return Promise.resolve({});
          }
          capture.userWrite = values;
          return {
            returning: () => Promise.resolve([{ id: "new-user-id" }]),
          };
        }),
      };
    }),
  };
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registration schema", () => {
  it("accepts valid input", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );

    await registerCandidate({
      name: "Almaz Tesfaye",
      email: "  ALMAZ@Example.com ",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
  });

  it("rejects a blank name", async () => {
    const r = await registerCandidate({
      name: "   ",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an invalid email", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "not-an-email",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a short password", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects a password mismatch", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "different-password",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an overlong name", async () => {
    const r = await registerCandidate({
      name: "x".repeat(101),
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects unknown properties", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
      extraField: "x",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects role injection", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
      role: "SUPER_ADMIN",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects userId injection", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
      userId: "controlled-id",
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects isActive injection", async () => {
    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
      isActive: false,
    });
    expect(r).toEqual({ ok: false, code: "invalid_input" });
  });
});

describe("registration DAL", () => {
  it("creates an active CANDIDATE with a hashed password", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );

    const r = await registerCandidate({
      name: "Almaz Tesfaye",
      email: "ALMAZ@Example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });

    expect(r).toEqual({ ok: true, userId: "new-user-id" });
    expect(capture.userWrite).toBeTruthy();
    const stored = capture.userWrite!;
    expect(stored.role).toBe("CANDIDATE");
    // isActive comes from the DB default, never set client-side.
    expect(stored.isActive).toBeUndefined();
    // password is hashed (scrypt), never stored in plaintext.
    expect(stored.passwordHash).not.toBe("correct-password-123");
    expect(String(stored.passwordHash)).toMatch(/^scrypt\$/);
    // confirmPassword is never stored.
    expect(stored.confirmPassword).toBeUndefined();
    expect(JSON.stringify(capture.userWrite)).not.toContain("correct-password-123");
    // email is normalized to lowercase.
    expect(stored.email).toBe("almaz@example.com");
  });

  it("does not accept a client-supplied role", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
      role: "ADMIN",
    });
    expect(capture.userWrite).toBeUndefined();
  });

  it("writes a CANDIDATE_REGISTERED audit entry with no PII", async () => {
    const capture: TxCapture = {};
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );
    await registerCandidate({
      name: "Almaz Tesfaye",
      email: "almaz@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });

    expect(capture.auditWrite).toBeTruthy();
    const serialized = JSON.stringify(capture.auditWrite);
    expect(capture.auditWrite!.action).toBe("CANDIDATE_REGISTERED");
    expect(capture.auditWrite!.targetType).toBe("user");
    expect(capture.auditWrite!.targetId).toBe("new-user-id");
    expect(capture.auditWrite!.actorUserId).toBe("new-user-id");
    expect(serialized).not.toContain("almaz@example.com");
    expect(serialized).not.toContain("Almaz");
    expect(serialized).not.toContain("correct-password-123");
  });

  it("maps a unique-violation error to a neutral duplicate result", async () => {
    const capture: TxCapture = {
      userInsertError: Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
        code: "23505",
      }),
    };
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );

    const r = await registerCandidate({
      name: "A",
      email: "dup@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
    expect(r).toEqual({ ok: false, code: "duplicate" });
  });

  it("does not leak raw database errors for other failures", async () => {
    const capture: TxCapture = {
      userInsertError: new Error("connection refused"),
    };
    mocks.mockTransaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
      fn(buildTx(capture)),
    );

    const r = await registerCandidate({
      name: "A",
      email: "a@example.com",
      password: "correct-password-123",
      confirmPassword: "correct-password-123",
    });
    expect(r).toEqual({ ok: false, code: "error" });
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain("connection refused");
  });
});

describe("isDuplicateError", () => {
  it("recognizes the users_email_unique constraint name", () => {
    expect(
      isDuplicateError(
        new Error('duplicate key value violates unique constraint "users_email_unique"'),
      ),
    ).toBe(true);
  });
  it("recognizes the sqlstate 23505", () => {
    const err = new Error("duplicate");
    (err as { code?: string }).code = "23505";
    expect(isDuplicateError(err)).toBe(true);
  });
  it("returns false for unrelated errors", () => {
    expect(isDuplicateError(new Error("boom"))).toBe(false);
    expect(isDuplicateError("not-an-error")).toBe(false);
  });
});
