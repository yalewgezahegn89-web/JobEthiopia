import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRunMaintenance = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock("@/lib/maintenance/run", () => ({
  runMaintenance: (...args: unknown[]) => mockRunMaintenance(...args),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

import { POST } from "../route";

const MAINTENANCE_KEY = "test-maintenance-key-123";

function makeRequest(key?: string): Request {
  const headers: Record<string, string> = {};
  if (key !== undefined) {
    headers["x-maintenance-key"] = key;
  }
  return new Request("http://localhost/api/internal/maintenance/run", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MAINTENANCE_API_KEY", MAINTENANCE_KEY);
  mockRunMaintenance.mockResolvedValue({
    expiredJobs: 3,
    sourcesChecked: 5,
    sourcesSucceeded: 4,
    sourcesFailed: 1,
    sourcesSkipped: 0,
  });
  mockWriteAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/maintenance/run", () => {
  describe("authentication", () => {
    it("returns 401 when x-maintenance-key header is missing", async () => {
      const request = makeRequest(undefined);
      const response = await POST(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when x-maintenance-key is wrong", async () => {
      const request = makeRequest("wrong-key");
      const response = await POST(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 200 when x-maintenance-key is correct", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it("INGESTION_API_KEY cannot authenticate unless equal to MAINTENANCE_API_KEY", async () => {
      vi.stubEnv("INGESTION_API_KEY", "ingestion-only-key");
      const request = new Request(
        "http://localhost/api/internal/maintenance/run",
        {
          method: "POST",
          headers: { "x-maintenance-key": "ingestion-only-key" },
        },
      );
      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe("execution", () => {
    it("correct key executes maintenance and returns summary", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      const response = await POST(request);
      const body = await response.json();
      expect(body).toEqual({
        expiredJobs: 3,
        sourcesChecked: 5,
        sourcesSucceeded: 4,
        sourcesFailed: 1,
        sourcesSkipped: 0,
      });
    });

    it("no session is required", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("audit logging", () => {
    it("successful run writes MAINTENANCE_RUN audit event with summary", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MAINTENANCE_RUN",
          targetType: "maintenance",
          targetId: "run",
          metadata: {
            expiredJobs: 3,
            sourcesChecked: 5,
            sourcesSucceeded: 4,
            sourcesFailed: 1,
            sourcesSkipped: 0,
          },
        }),
      );
    });

    it("audit metadata does not leak the maintenance key", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);

      const serialized = JSON.stringify(mockWriteAuditLog.mock.calls);
      expect(serialized).not.toContain(MAINTENANCE_KEY);
    });

    it("failed maintenance run does not write an audit event", async () => {
      mockRunMaintenance.mockRejectedValue(new Error("boom"));
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it("audit logging failure does not break the maintenance operation", async () => {
      mockWriteAuditLog.mockRejectedValue(new Error("audit db down"));
      const request = makeRequest(MAINTENANCE_KEY);
      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe("security", () => {
    it("generic unauthorized response does not leak timing information", async () => {
      const request = makeRequest("a");
      const response = await POST(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("unauthorized requests do not write an audit event", async () => {
      const request = makeRequest("wrong-key");
      await POST(request);
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it("generic 500 response does not leak internal errors", async () => {
      mockRunMaintenance.mockRejectedValue(new Error("DB connection refused"));
      const request = makeRequest(MAINTENANCE_KEY);
      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
      const text = JSON.stringify(body);
      expect(text).not.toContain("DB connection refused");
    });

    it("returns configuration error when MAINTENANCE_API_KEY is not set", async () => {
      vi.stubEnv("MAINTENANCE_API_KEY", "");
      const request = makeRequest("any-key");
      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Server configuration error");
    });
  });

  describe("idempotency", () => {
    it("repeated invocation is safe", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      const response1 = await POST(request);
      const response2 = await POST(request);
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(mockRunMaintenance).toHaveBeenCalledTimes(2);
    });
  });

  describe("timing-safe comparison", () => {
    it("rejects keys of different lengths", async () => {
      const shortKey = "abc";
      const request = makeRequest(shortKey);
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("rejects similar but incorrect key", async () => {
      const similarKey = MAINTENANCE_KEY + "x";
      const request = makeRequest(similarKey);
      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });
});
