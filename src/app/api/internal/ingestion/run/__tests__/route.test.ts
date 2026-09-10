import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRunSourceIngestion = vi.fn();
const mockRunSourcesIngestion = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock("@/lib/ingestion/runSource", () => ({
  runSourceIngestion: (...args: unknown[]) => mockRunSourceIngestion(...args),
  runSourcesIngestion: (...args: unknown[]) => mockRunSourcesIngestion(...args),
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
    `http://localhost/api/internal/ingestion/run${search}`,
    { method: "POST", headers },
  );
}

function runSourceResult(overrides: Record<string, unknown> = {}) {
  return {
    sourceId: SOURCE_ID,
    status: "SUCCEEDED",
    reason: null,
    total: 2,
    created: 1,
    updated: 1,
    duplicate: 0,
    linked: 0,
    possibleDuplicate: 0,
    failed: 0,
    durationMs: 5,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MAINTENANCE_API_KEY", MAINTENANCE_KEY);
  mockRunSourcesIngestion.mockResolvedValue({
    checked: 2,
    succeeded: 1,
    failed: 1,
    skipped: 0,
  });
  mockRunSourceIngestion.mockResolvedValue(runSourceResult());
  mockWriteAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/ingestion/run", () => {
  describe("authentication", () => {
    it("returns 401 when x-maintenance-key header is missing", async () => {
      const response = await POST(makeRequest(undefined));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when x-maintenance-key is wrong", async () => {
      const response = await POST(makeRequest("wrong-key"));
      expect(response.status).toBe(401);
    });

    it("returns 200 when x-maintenance-key is correct", async () => {
      const response = await POST(makeRequest(MAINTENANCE_KEY));
      expect(response.status).toBe(200);
    });

    it("INGESTION_API_KEY cannot authenticate unless equal to MAINTENANCE_API_KEY", async () => {
      vi.stubEnv("INGESTION_API_KEY", "ingestion-only-key");
      const response = await POST(makeRequest("ingestion-only-key"));
      expect(response.status).toBe(401);
    });

    it("returns configuration error when MAINTENANCE_API_KEY is not set", async () => {
      vi.stubEnv("MAINTENANCE_API_KEY", "");
      const response = await POST(makeRequest("any-key"));
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Server configuration error");
    });

    it("rejects keys of different lengths", async () => {
      const response = await POST(makeRequest("abc"));
      expect(response.status).toBe(401);
    });
  });

  describe("due-sources run", () => {
    it("runs due sources and returns the summary", async () => {
      const response = await POST(makeRequest(MAINTENANCE_KEY));
      const body = await response.json();
      expect(body).toEqual({ checked: 2, succeeded: 1, failed: 1, skipped: 0 });
      expect(mockRunSourcesIngestion).toHaveBeenCalledTimes(1);
      expect(mockRunSourceIngestion).not.toHaveBeenCalled();
    });

    it("writes a single INGESTION_RUN audit event with counts", async () => {
      await POST(makeRequest(MAINTENANCE_KEY));
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "INGESTION_RUN",
          targetType: "ingestion",
          targetId: "run",
          metadata: expect.objectContaining({
            scope: "due",
            checked: 2,
            succeeded: 1,
            failed: 1,
            skipped: 0,
          }),
        }),
      );
    });

    it("audit metadata does not leak the maintenance key", async () => {
      await POST(makeRequest(MAINTENANCE_KEY));
      const serialized = JSON.stringify(mockWriteAuditLog.mock.calls);
      expect(serialized).not.toContain(MAINTENANCE_KEY);
    });

    it("audit logging failure does not break the run", async () => {
      mockWriteAuditLog.mockRejectedValue(new Error("audit db down"));
      const response = await POST(makeRequest(MAINTENANCE_KEY));
      expect(response.status).toBe(200);
    });
  });

  describe("single-source run", () => {
    it("runs a single source when sourceId is provided", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, `?sourceId=${SOURCE_ID}`),
      );
      expect(response.status).toBe(200);
      expect(mockRunSourceIngestion).toHaveBeenCalledWith(SOURCE_ID);
      expect(mockRunSourcesIngestion).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body.item.sourceId).toBe(SOURCE_ID);
      expect(body.item.status).toBe("SUCCEEDED");
    });

    it("returns 400 for an invalid sourceId", async () => {
      const response = await POST(
        makeRequest(MAINTENANCE_KEY, "?sourceId=not-a-uuid"),
      );
      expect(response.status).toBe(400);
      expect(mockRunSourceIngestion).not.toHaveBeenCalled();
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("security", () => {
    it("generic 500 response does not leak internal errors", async () => {
      mockRunSourcesIngestion.mockRejectedValue(
        new Error("DB connection refused"),
      );
      const response = await POST(makeRequest(MAINTENANCE_KEY));
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
      expect(JSON.stringify(body)).not.toContain("DB connection refused");
    });

    it("failed runs do not write an audit event", async () => {
      mockRunSourcesIngestion.mockRejectedValue(new Error("boom"));
      await POST(makeRequest(MAINTENANCE_KEY));
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it("unauthorized requests do not write an audit event", async () => {
      await POST(makeRequest("wrong-key"));
      expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("observability logs", () => {
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function records(spy: ReturnType<typeof vi.spyOn>) {
      return spy.mock.calls.map(([arg]) => JSON.parse(arg as string));
    }

    it("emits ingestion_run_started and ingestion_run_completed on success", async () => {
      await POST(makeRequest(MAINTENANCE_KEY));
      const events = records(infoSpy).map((r) => r.event);
      expect(events).toContain("ingestion_run_started");
      expect(events).toContain("ingestion_run_completed");
    });

    it("completed log includes counts and duration, but no key", async () => {
      await POST(makeRequest(MAINTENANCE_KEY));
      const completed = records(infoSpy).find(
        (r) => r.event === "ingestion_run_completed",
      );
      expect(completed).toBeDefined();
      expect(completed.checked).toBe(2);
      expect(completed.succeeded).toBe(1);
      const raw = JSON.stringify(records(infoSpy));
      expect(raw).not.toContain(MAINTENANCE_KEY);
    });

    it("emits ingestion_run_failed with stable errorCode on failure", async () => {
      mockRunSourcesIngestion.mockRejectedValue(new Error("boom"));
      await POST(makeRequest(MAINTENANCE_KEY));
      const failed = records(errorSpy).find(
        (r) => r.event === "ingestion_run_failed",
      );
      expect(failed).toBeDefined();
      expect(failed.errorCode).toBe("INTERNAL_ERROR");
      const raw = JSON.stringify(records(errorSpy));
      expect(raw).not.toContain("boom");
    });
  });
});