import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

const capturedValues: Record<string, unknown>[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      insert: mocks.mockInsert,
    },
  };
});

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: mocks.mockGetRequestId,
}));

const mockInsert = mocks.mockInsert;
const mockGetRequestId = mocks.mockGetRequestId;

import { writeAuditLog, sanitizeMetadata } from "../audit";
import { fingerprintApiKey } from "../apiKey";

beforeEach(() => {
  vi.clearAllMocks();
  capturedValues.length = 0;
  mockInsert.mockImplementation(() => ({
    values: async (values: Record<string, unknown>) => {
      capturedValues.push(values);
      return [];
    },
  }));
  mockGetRequestId.mockResolvedValue(undefined);
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

describe("audit attribution for api-key mutations", () => {
  it("adds a non-secret credentialId to api_key-sourced events", async () => {
    vi.stubEnv("INGESTION_API_KEY", "configured-shared-key");

    await writeAuditLog({
      action: "JOB_CREATED",
      targetType: "job",
      metadata: { source: "api_key" },
    });

    const row = capturedValues[0];
    const metadata = row.metadata as Record<string, unknown>;
    expect(metadata.credentialId).toBeTypeOf("string");
    expect(metadata.credentialId).toMatch(/^apikey_/);
    expect(metadata.credentialId).not.toContain("configured-shared-key");
    expect(JSON.stringify(row)).not.toContain("configured-shared-key");
  });

  it("derives a stable fingerprint across events for the single shared key", async () => {
    vi.stubEnv("INGESTION_API_KEY", "configured-shared-key");

    await writeAuditLog({
      action: "JOB_CREATED",
      metadata: { source: "api_key" },
    });
    const first = (
      capturedValues[0].metadata as Record<string, unknown>
    ).credentialId;

    await writeAuditLog({
      action: "JOB_DELETED",
      metadata: { source: "api_key" },
    });
    const second = (
      capturedValues[1].metadata as Record<string, unknown>
    ).credentialId;

    expect(second).toBe(first);
  });

  it("never writes the raw API key, even for api_key-sourced events", async () => {
    vi.stubEnv("INGESTION_API_KEY", "raw-super-secret");

    await writeAuditLog({
      action: "SOURCE_CREATED",
      metadata: { source: "api_key", name: "test-source" },
    });

    const metadata = capturedValues[0].metadata as Record<string, unknown>;
    expect(JSON.stringify(capturedValues)).not.toContain("raw-super-secret");
    expect(metadata.credentialId).toBe(fingerprintApiKey("raw-super-secret"));
  });

  it("does not add a credentialId for non-api_key events", async () => {
    await writeAuditLog({
      actorUserId: "user-1",
      action: "LOGIN_SUCCESS",
      metadata: { method: "password" },
    });
    const metadata = capturedValues[0].metadata as Record<string, unknown>;
    expect(metadata.credentialId).toBeUndefined();
    expect(capturedValues[0].actorUserId).toBe("user-1");
  });

  it("preserves the actorUserId for user-driven api_key events", async () => {
    vi.stubEnv("INGESTION_API_KEY", "configured-shared-key");

    await writeAuditLog({
      actorUserId: "user-9",
      action: "ORG_UPDATED",
      metadata: { source: "api_key" },
    });

    expect(capturedValues[0].actorUserId).toBe("user-9");
  });

  it("records the requestId when the active request has one", async () => {
    mockGetRequestId.mockResolvedValue("req-123");

    await writeAuditLog({ action: "SOME_EVENT", metadata: { source: "api_key" } });

    const metadata = capturedValues[0].metadata as Record<string, unknown>;
    expect(metadata.requestId).toBe("req-123");
  });

  it("omits requestId when no request context exists", async () => {
    mockGetRequestId.mockResolvedValue(undefined);

    await writeAuditLog({ action: "SOME_EVENT", metadata: { source: "api_key" } });

    const metadata = capturedValues[0].metadata as Record<string, unknown>;
    expect(metadata.requestId).toBeUndefined();
  });
});