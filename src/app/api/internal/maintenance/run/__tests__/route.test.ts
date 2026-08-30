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
          metadata: expect.objectContaining({
            expiredJobs: 3,
            sourcesChecked: 5,
            sourcesSucceeded: 4,
            sourcesFailed: 1,
            sourcesSkipped: 0,
          }),
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

  describe("observability logs (Batch 76)", () => {
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function events(spy: ReturnType<typeof vi.spyOn>): string[] {
      return spy.mock.calls.map(([arg]) => JSON.parse(arg as string).event);
    }

    it("emits maintenance_started and maintenance_completed on success", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);

      expect(events(infoSpy)).toContain("maintenance_started");
      expect(events(infoSpy)).toContain("maintenance_completed");
    });

    it("maintenance_completed includes counts and duration, but no key", async () => {
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);

      const records = infoSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
      const completed = records.find(
        (r) => r.event === "maintenance_completed",
      );
      expect(completed).toBeDefined();
      expect(completed.durationMs).toBeGreaterThanOrEqual(0);
      expect(completed.sourcesChecked).toBe(5);
      expect(completed.sourcesFailed).toBe(1);
      const raw = JSON.stringify(records);
      expect(raw).not.toContain(MAINTENANCE_KEY);
    });

    it("emits maintenance_failed with stable errorCode on failure", async () => {
      mockRunMaintenance.mockRejectedValue(new Error("boom"));
      const request = makeRequest(MAINTENANCE_KEY);
      await POST(request);

      const records = errorSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
      const failed = records.find((r) => r.event === "maintenance_failed");
      expect(failed).toBeDefined();
      expect(failed.errorCode).toBe("INTERNAL_ERROR");
      expect(failed.status).toBe(500);
      const raw = JSON.stringify(records);
      expect(raw).toContain("maintenance_failed");
      expect(raw).not.toContain("boom");
    });
  });
});
