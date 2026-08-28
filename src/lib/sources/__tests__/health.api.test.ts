import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSourceHealth = vi.fn();

vi.mock("../../sources/health", () => ({
  getSourceHealth: (...args: unknown[]) => mockGetSourceHealth(...args),
}));

import { GET } from "../../../app/api/sources/[id]/health/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const SAMPLE_HEALTH = {
  sourceId: VALID_ID,
  lastSuccessfulCheck: new Date("2026-01-15T00:00:00Z"),
  lastAttemptedCheck: new Date("2026-01-15T12:00:00Z"),
  lastError: null,
  checkFrequencyMinutes: 60,
  consecutiveFailures: 0,
};

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/sources/${id}/health`, {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSourceHealth.mockResolvedValue(SAMPLE_HEALTH);
});

describe("GET /api/sources/[id]/health", () => {
  describe("successful retrieval", () => {
    it("returns 200 with health data for valid UUID", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.sourceId).toBe(VALID_ID);
    });

    it("response contains expected health fields", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).toHaveProperty("sourceId");
      expect(data.item).toHaveProperty("lastSuccessfulCheck");
      expect(data.item).toHaveProperty("lastAttemptedCheck");
      expect(data.item).toHaveProperty("hasError");
      expect(data.item).toHaveProperty("checkFrequencyMinutes");
      expect(data.item).toHaveProperty("consecutiveFailures");
    });

    it("lastError is NOT present in response", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).not.toHaveProperty("lastError");
    });

    it("hasError is false when lastError is null", async () => {
      mockGetSourceHealth.mockResolvedValue({
        ...SAMPLE_HEALTH,
        lastError: null,
      });

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item.hasError).toBe(false);
    });

    it("hasError is true when lastError exists", async () => {
      mockGetSourceHealth.mockResolvedValue({
        ...SAMPLE_HEALTH,
        lastError: "Connection refused",
      });

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item.hasError).toBe(true);
    });

    it("null health timestamps remain null", async () => {
      mockGetSourceHealth.mockResolvedValue({
        sourceId: VALID_ID,
        lastSuccessfulCheck: null,
        lastAttemptedCheck: null,
        lastError: null,
        checkFrequencyMinutes: null,
        consecutiveFailures: 0,
      });

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item.lastSuccessfulCheck).toBeNull();
      expect(data.item.lastAttemptedCheck).toBeNull();
      expect(data.item.checkFrequencyMinutes).toBeNull();
    });
  });

  describe("not found", () => {
    it("returns 404 when source does not exist", async () => {
      mockGetSourceHealth.mockResolvedValue(null);

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makeGetRequest("not-a-uuid");
      const response = await GET(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid source ID");
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockGetSourceHealth.mockRejectedValue(new Error("DB connection failed"));

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("internal error details are not leaked", async () => {
      mockGetSourceHealth.mockRejectedValue(
        new Error("SECRET_DB_PASSWORD=xyz connection refused"),
      );

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});
