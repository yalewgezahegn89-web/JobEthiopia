import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}));

const capturedValues: Record<string, unknown>[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      insert: mocks.mockInsert,
    },
  };
});

const mockInsert = mocks.mockInsert;

import { writeAuditLog, sanitizeMetadata } from "../audit";

beforeEach(() => {
  vi.clearAllMocks();
  capturedValues.length = 0;
  mockInsert.mockImplementation(() => ({
    values: async (values: Record<string, unknown>) => {
      capturedValues.push(values);
      return [];
    },
  }));
});

describe("audit log", () => {
  it("writes a login success event", async () => {
    await writeAuditLog({
      actorUserId: "user-1",
      action: "LOGIN_SUCCESS",
      targetType: "user",
      targetId: "user-1",
    });
    expect(capturedValues).toHaveLength(1);
    expect(capturedValues[0].action).toBe("LOGIN_SUCCESS");
    expect(capturedValues[0].actorUserId).toBe("user-1");
  });

  it("writes a logout event", async () => {
    await writeAuditLog({
      actorUserId: "user-1",
      action: "LOGOUT",
      targetType: "user",
      targetId: "user-1",
    });
    expect(capturedValues[0].action).toBe("LOGOUT");
  });

  it("allows a null actor for system events", async () => {
    await writeAuditLog({ action: "BOOTSTRAP_ADMIN" });
    expect(capturedValues[0].actorUserId).toBeNull();
    expect(capturedValues[0].action).toBe("BOOTSTRAP_ADMIN");
  });

  it("strips password, token, secret, and hash keys from metadata", async () => {
    await writeAuditLog({
      action: "SOME_EVENT",
      metadata: {
        email: "a@b.com",
        passwordHash: "abc",
        sessionToken: "xyz",
        apiSecret: "secret",
        password: "plain",
        reason: "ok",
      },
    });
    const metadata = capturedValues[0].metadata as Record<string, unknown>;
    expect(metadata).toEqual({ email: "a@b.com", reason: "ok" });
  });

  it("never throws when the database insert fails", async () => {
    mockInsert.mockImplementationOnce(() => ({
      values: () => Promise.reject(new Error("db down")),
    }));
    await expect(
      writeAuditLog({ action: "SOME_EVENT" }),
    ).resolves.toBeUndefined();
  });

  it("serializes metadata as JSON-safe values", async () => {
    await writeAuditLog({
      action: "SOME_EVENT",
      metadata: { count: 3, ok: true, note: "x" },
    });
    const metadata = JSON.parse(JSON.stringify(capturedValues[0].metadata));
    expect(metadata).toEqual({ count: 3, ok: true, note: "x" });
  });

  it("treats undefined metadata as null", async () => {
    await writeAuditLog({ action: "SOME_EVENT", metadata: undefined });
    expect(capturedValues[0].metadata).toBeNull();
  });

  it("sanitizeMetadata handles empty objects", () => {
    expect(sanitizeMetadata({})).toEqual({});
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata(undefined)).toBeNull();
  });
});