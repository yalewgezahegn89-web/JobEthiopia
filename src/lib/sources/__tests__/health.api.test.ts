import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSourceHealth,
  mockRecordSuccessfulCheck,
  mockRecordFailedCheck,
  mockSsrfFetch,
  mockFindFirst,
} = vi.hoisted(() => ({
  mockGetSourceHealth: vi.fn(),
  mockRecordSuccessfulCheck: vi.fn(),
  mockRecordFailedCheck: vi.fn(),
  mockSsrfFetch: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: mockSsrfFetch,
  SsrfError: class SsrfError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SsrfError";
    }
  },
}));

vi.mock("../../sources/health", () => ({
  getSourceHealth: (...args: unknown[]) => mockGetSourceHealth(...args),
  recordSuccessfulCheck: (...args: unknown[]) =>
    mockRecordSuccessfulCheck(...args),
  recordFailedCheck: (...args: unknown[]) => mockRecordFailedCheck(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/db/schema/sources", () => ({
  sources: { id: "sources_id_column" },
}));

import { GET, POST } from "../../../app/api/sources/[id]/health/route";

const API_KEY = "test-api-key-123";
const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const SAMPLE_HEALTH = {
  sourceId: VALID_ID,
  lastSuccessfulCheck: new Date("2026-01-15T00:00:00Z"),
  lastAttemptedCheck: new Date("2026-01-15T12:00:00Z"),
  lastError: null,
  checkFrequencyMinutes: 60,
  consecutiveFailures: 0,
};

const SAMPLE_SOURCE = {
  id: VALID_ID,
  baseUrl: "https://example.com/jobs",
  sourceType: "WEBSITE",
  name: "Example Jobs",
};

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/sources/${id}/health`, {
    method: "GET",
  });
}

function makePostRequest(
  id: string,
  headers: Record<string, string> = { "x-api-key": API_KEY },
): Request {
  return new Request(`http://localhost/api/sources/${id}/health`, {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGESTION_API_KEY", API_KEY);
  mockGetSourceHealth.mockResolvedValue(SAMPLE_HEALTH);
  mockFindFirst.mockResolvedValue(SAMPLE_SOURCE);
  mockRecordSuccessfulCheck.mockResolvedValue({
    ...SAMPLE_HEALTH,
    lastSuccessfulCheck: new Date(),
    lastAttemptedCheck: new Date(),
  });
  mockRecordFailedCheck.mockResolvedValue({
    ...SAMPLE_HEALTH,
    lastError: "Connection failed",
    lastAttemptedCheck: new Date(),
  });
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

describe("POST /api/sources/[id]/health", () => {
  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePostRequest(VALID_ID, {});
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePostRequest(VALID_ID, {
        "x-api-key": "wrong-key",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePostRequest(VALID_ID, {
        "x-api-key": "wrong-key",
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("wrong-key");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makePostRequest("not-a-uuid");
      const response = await POST(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid source ID");
    });
  });

  describe("not found", () => {
    it("returns 404 when source does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });
  });

  describe("missing base URL", () => {
    it("returns 422 when source has no baseUrl", async () => {
      mockFindFirst.mockResolvedValue({
        ...SAMPLE_SOURCE,
        baseUrl: null,
      });

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Source has no base URL configured");
    });
  });

  describe("successful check", () => {
    it("returns 200 when source is reachable", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.reachable).toBe(true);
      expect(mockRecordSuccessfulCheck).toHaveBeenCalledWith(VALID_ID);
    });

    it("records success when HTTP status is 200", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const request = makePostRequest(VALID_ID);
      await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockRecordSuccessfulCheck).toHaveBeenCalledTimes(1);
      expect(mockRecordFailedCheck).not.toHaveBeenCalled();
    });

    it("calls ssrfFetch with HEAD method", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const request = makePostRequest(VALID_ID);
      await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockSsrfFetch).toHaveBeenCalledWith(
        SAMPLE_SOURCE.baseUrl,
        { method: "HEAD" },
      );
    });
  });

  describe("unreachable source", () => {
    it("returns 200 with reachable=false when HTTP status is 500", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.reachable).toBe(false);
      expect(mockRecordFailedCheck).toHaveBeenCalledWith(VALID_ID, "HTTP 500");
    });

    it("returns 200 with reachable=false on connection error", async () => {
      mockSsrfFetch.mockRejectedValue(
        new Error("ECONNREFUSED"),
      );

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.reachable).toBe(false);
      expect(mockRecordFailedCheck).toHaveBeenCalledWith(
        VALID_ID,
        "ECONNREFUSED",
      );
    });

    it("returns 200 with reachable=false on abort/timeout", async () => {
      mockSsrfFetch.mockRejectedValue(
        new Error("The operation was aborted"),
      );

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.reachable).toBe(false);
    });

    it("records failure with error message on HTTP 404", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const request = makePostRequest(VALID_ID);
      await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockRecordFailedCheck).toHaveBeenCalledWith(VALID_ID, "HTTP 404");
      expect(mockRecordSuccessfulCheck).not.toHaveBeenCalled();
    });
  });

  describe("response shape", () => {
    it("returns health fields in response", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).toHaveProperty("sourceId");
      expect(data.item).toHaveProperty("reachable");
      expect(data.item).toHaveProperty("lastSuccessfulCheck");
      expect(data.item).toHaveProperty("lastAttemptedCheck");
      expect(data.item).toHaveProperty("hasError");
      expect(data.item).toHaveProperty("checkFrequencyMinutes");
      expect(data.item).toHaveProperty("consecutiveFailures");
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockFindFirst.mockRejectedValue(new Error("DB connection failed"));

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("internal error details are not leaked", async () => {
      mockFindFirst.mockRejectedValue(
        new Error("SECRET_DB_PASSWORD=xyz connection refused"),
      );

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });

    it("returns 404 when recordSuccessfulCheck returns null", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });
      mockRecordSuccessfulCheck.mockResolvedValue(null);

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });

    it("returns 404 when recordFailedCheck returns null", async () => {
      mockSsrfFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });
      mockRecordFailedCheck.mockResolvedValue(null);

      const request = makePostRequest(VALID_ID);
      const response = await POST(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });
  });
});
