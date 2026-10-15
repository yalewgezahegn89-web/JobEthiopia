import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthAccountsFindFirst = vi.fn();
const mockUsersFindFirst = vi.fn();
const mockVerifyOtp = vi.fn();
const mockCreateSession = vi.fn();
const mockRevokeSession = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      authAccounts: { findFirst: (...a: unknown[]) => mockAuthAccountsFindFirst(...a) },
      users: { findFirst: (...a: unknown[]) => mockUsersFindFirst(...a) },
    },
    transaction: async (fn: (t: { insert: (...a: unknown[]) => unknown }) => Promise<unknown>) =>
      fn({
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: "tx-user" }],
            then: (resolve: (...a: unknown[]) => unknown) => resolve([]),
          }),
        }),
      }),
    insert: () => ({ values: async () => [] }),
  },
}));

vi.mock("../session", () => ({
  createSession: (...a: unknown[]) => mockCreateSession(...a),
  revokeSession: (...a: unknown[]) => mockRevokeSession(...a),
}));

vi.mock("../phone-verification", () => ({
  verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
}));

vi.mock("../audit", () => ({
  writeAuditLog: (...a: unknown[]) => mockWriteAuditLog(...a),
}));

import {
  validatePhoneUserName,
  resolvePhoneUser,
  createPhoneUser,
  signInWithVerifiedPhone,
  createPhoneAccount,
} from "../phoneAuth";

const PHONE = "+251912345678";
const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Abebe Kebede",
  role: "CANDIDATE",
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSession.mockResolvedValue("raw-session-token");
  mockRevokeSession.mockResolvedValue(CANDIDATE.id);
});

describe("validatePhoneUserName", () => {
  it("accepts a trimmed non-empty name", () => {
    expect(validatePhoneUserName("  Abebe Kebede  ")).toEqual({
      ok: true,
      name: "Abebe Kebede",
    });
  });

  it("rejects missing / empty / whitespace-only names", () => {
    expect(validatePhoneUserName("")).toEqual({ ok: false, reason: "missing_name" });
    expect(validatePhoneUserName("   ")).toEqual({ ok: false, reason: "missing_name" });
    expect(validatePhoneUserName(undefined)).toEqual({ ok: false, reason: "missing_name" });
  });

  it("rejects names that are too long", () => {
    expect(validatePhoneUserName("a".repeat(101))).toEqual({
      ok: false,
      reason: "name_too_long",
    });
  });
});

describe("resolvePhoneUser", () => {
  it("resolves an existing verified phone to its user", async () => {
    mockAuthAccountsFindFirst.mockResolvedValue({ userId: CANDIDATE.id });
    mockUsersFindFirst.mockResolvedValue(CANDIDATE);

    const result = await resolvePhoneUser(PHONE);
    expect(result).toEqual({ ok: true, user: CANDIDATE });
  });

  it("returns no_account when the phone has no linked identity", async () => {
    mockAuthAccountsFindFirst.mockResolvedValue(null);
    expect(await resolvePhoneUser(PHONE)).toEqual({ ok: false, reason: "no_account" });
  });

  it("returns no_account when the linked user is missing", async () => {
    mockAuthAccountsFindFirst.mockResolvedValue({ userId: CANDIDATE.id });
    mockUsersFindFirst.mockResolvedValue(null);
    expect(await resolvePhoneUser(PHONE)).toEqual({ ok: false, reason: "no_account" });
  });

  it("rejects an invalid phone", async () => {
    expect(await resolvePhoneUser("12345")).toEqual({ ok: false, reason: "invalid_phone" });
  });

  it("returns error on DB failure", async () => {
    mockAuthAccountsFindFirst.mockRejectedValue(new Error("db down"));
    expect(await resolvePhoneUser(PHONE)).toEqual({ ok: false, reason: "error" });
  });
});

describe("createPhoneUser", () => {
  it("creates a phone-first candidate", async () => {
    const result = await createPhoneUser(PHONE, "Abebe Kebede");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe("CANDIDATE");
      expect(result.user.isActive).toBe(true);
    }
  });

  it("rejects an invalid phone", async () => {
    expect(await createPhoneUser("123", "Abebe")).toEqual({
      ok: false,
      reason: "invalid_phone",
    });
  });

  it("rejects an invalid name", async () => {
    expect(await createPhoneUser(PHONE, "")).toEqual({
      ok: false,
      reason: "invalid_name",
    });
  });
});

describe("signInWithVerifiedPhone", () => {
  it("signs in an existing verified phone user", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: true, phone: PHONE, userId: CANDIDATE.id });
    mockAuthAccountsFindFirst.mockResolvedValue({ userId: CANDIDATE.id });
    mockUsersFindFirst.mockResolvedValue(CANDIDATE);

    const result = await signInWithVerifiedPhone("req-1", "123456", PHONE);
    expect(result).toEqual({
      ok: true,
      rawToken: "raw-session-token",
      user: { id: CANDIDATE.id, name: CANDIDATE.name, role: CANDIDATE.role },
    });
    expect(mockCreateSession).toHaveBeenCalledWith(CANDIDATE.id);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PHONE_LOGIN_SUCCESS" }),
    );
  });

  it("fails opaquely when the phone has no linked account", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: true, phone: PHONE, userId: null });
    mockAuthAccountsFindFirst.mockResolvedValue(null);

    const result = await signInWithVerifiedPhone("req-1", "123456", PHONE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_account");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PHONE_LOGIN_FAILURE" }),
    );
  });

  it("propagates OTP failure without creating a session", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: false, reason: "expired" });
    const result = await signInWithVerifiedPhone("req-1", "000000", PHONE);
    expect(result.ok).toBe(false);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe("createPhoneAccount", () => {
  it("creates a new candidate and issues a session", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: true, phone: PHONE, userId: null });
    mockAuthAccountsFindFirst.mockResolvedValue(null);

    const result = await createPhoneAccount("req-1", "123456", PHONE, "Abebe");
    expect(result.ok).toBe(true);
    expect(mockCreateSession).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PHONE_LOGIN_SUCCESS" }),
    );
  });

  it("signs in the existing account when the phone is already linked (race)", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: true, phone: PHONE, userId: null });
    mockAuthAccountsFindFirst.mockResolvedValue({ userId: CANDIDATE.id });
    mockUsersFindFirst.mockResolvedValue(CANDIDATE);

    const result = await createPhoneAccount("req-1", "123456", PHONE, "Abebe");
    expect(result.ok).toBe(true);
    expect(mockCreateSession).toHaveBeenCalledWith(CANDIDATE.id);
  });

  it("propagates OTP failure without creating a user", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: false, reason: "already_used" });
    const result = await createPhoneAccount("req-1", "000000", PHONE, "Abebe");
    expect(result.ok).toBe(false);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects when no name is supplied", async () => {
    const result = await createPhoneAccount("req-1", "123456", PHONE, "");
    expect(result.ok).toBe(false);
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
