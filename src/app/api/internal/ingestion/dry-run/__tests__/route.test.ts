import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDryRunSourceIngestion = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock("@/lib/ingestion/dryRun", () => ({
  dryRunSourceIngestion: (...args: unknown[]) =>
    mockDryRunSourceIngestion(...args),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

import { POST } from "../route";

const MAINTENANCE_KEY = "test-maintenance-key-123";
const SOURCE_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(key?: string, search = ""): Request {
  const headers: Record<string, string> = {};
  if (key !== undefined) {
    headers["x-maintenance-key"] = key;
  }
  return new Request(
    `http://localhost/api/internal/ingestion/dry-run${search}`,
    { method: "POST", headers },
  );
}

function dryRunResult(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: SOURCE_ID,
    sourceName: "Example Feed",
    sourceType: "FEED",
    fetchSuccess: true,
    fetchError: null,
    totalFetched: 2,
    totalValid: 1,
    totalInvalid: 1,
    totalDuplicate: 0,
    totalNew: 1,
    items: [
      {
        index: 0,
        valid: true,
        title: "Staff Nurse",
        organizationName: "Black Lion Hospital",
        normalizedTitle: "Staff Nurse",
        normalizedOrg: "Black Lion Hospital",
        employmentType: "FULL_TIME",
        salaryMin: 5000,
        salaryMax: 8000,
        salaryCurrency: "ETB",
        salaryPeriod: "MONTHLY",
        experienceMin: 3,
        experienceMax: 5,
        duplicateClassification: "UNIQUE",
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
        errors: [],
      },
    ],
    durationMs: 12,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MAINTENANCE_API_KEY", MAINTENANCE_KEY);
  mockDryRunSourceIngestion.mockResolvedValue(dryRunResult());
  mockWriteAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/ingestion/dry-run", () => {
  describe("authentication", () => {
    it("returns 401 when x-maintenance-key header is missing", async () => {
      const response = await POST(
        makeRequest(undefined, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when x-maintenance-key is wrong", async () => {
      const response = await POST(
        makeRequest("wrong-key", `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(401);
    });

    it("returns 200 when x-maintenance-key is correct", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(200);
    });

    it("INGESTION_API_KEY cannot authenticate unless equal to MAINTENANCE_API_KEY", async () => {
      vi.stubEnv("INGESTION_API_KEY", "ingestion-only-key");
      const response = await POST(
        makeRequest("ingestion-only-key", `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(401);
    });

    it("returns configuration error when MAINTENANCE_API_KEY is not set", async () => {
      vi.stubEnv("MAINTENANCE_API_KEY", "");
      const response = await POST(
        makeRequest("any-key", `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Server configuration error");
    });
  });

  describe("validation", () => {
    it("requires a sourceId", async () => {
      const response = await POST(makeRequest(MAINTENANCE_KEY));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("sourceId is required");
      expect(mockDryRunSourceIngestion).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid sourceId", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, "?sourceId=not-a-uuid"),
      );
      expect(response.status).toBe(400);
      expect(mockDryRunSourceIngestion).not.toHaveBeenCalled();
    });
  });

  describe("dry-run execution", () => {
    it("returns the dry-run result for the requested source", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      const body = await response.json();
      expect(body.result.sourceId).toBe(SOURCE_ID);
      expect(body.result.totalFetched).toBe(2);
      expect(mockDryRunSourceIngestion).toHaveBeenCalledWith(SOURCE_ID);
    });

    it("writes an INGESTION_DRY_RUN audit event without leaking the key", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(200);
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "INGESTION_DRY_RUN",
          targetType: "ingestion",
          targetId: "dry-run",
          metadata: expect.objectContaining({
            sourceId: SOURCE_ID,
            totalValid: 1,
          }),
        }),
      );
      const serialized = JSON.stringify(mockWriteAuditLog.mock.calls);
      expect(serialized).not.toContain(MAINTENANCE_KEY);
    });

    it("audit logging failure does not break the dry run", async () => {
      mockWriteAuditLog.mockRejectedValue(new Error("audit db down"));
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(200);
    });

    it("reports fetch failures back in the response without throwing", async () => {
      mockDryRunSourceIngestion.mockResolvedValue(
        dryRunResult({
          fetchSuccess: false,
          fetchError: "HTTP 503",
          totalFetched: 0,
          items: [],
        }),
      );
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.result.fetchSuccess).toBe(false);
      expect(body.result.fetchError).toBe("HTTP 503");
    });
  });

  describe("security", () => {
    it("generic 500 response does not leak internal errors", async () => {
      mockDryRunSourceIngestion.mockRejectedValue(
        new Error("DB connection refused"),
      );
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
      expect(JSON.stringify(body)).not.toContain("DB connection refused");
    });

    it("failed dry runs and unauthorized requests do not write an audit event", async () => {
      mockDryRunSourceIngestion.mockRejectedValue(new Error("boom"));
      await POST(makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`));
      expect(mockWriteAuditLog).not.toHaveBeenCalled();

      mockDryRunSourceIngestion.mockClear();
      await POST(makeRequest("wrong-key", `?sourceId=${SOURCE_ID}`));
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
  });
});