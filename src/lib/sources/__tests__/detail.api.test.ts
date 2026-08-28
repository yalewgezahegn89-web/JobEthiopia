import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("../../../db/schema/sources", () => ({
  sources: {
    id: "sources.id",
  },
}));

import { GET } from "../../../app/api/sources/[id]/route";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const SAMPLE_SOURCE = {
  id: VALID_ID,
  name: "Manual Entry",
  sourceType: "MANUAL",
  baseUrl: null,
  isActive: true,
  trustLevel: "HIGH",
  createdAt: new Date("2026-01-15T00:00:00Z"),
  updatedAt: new Date("2026-01-15T00:00:00Z"),
};

function makeGetRequest(id: string): Request {
  return new Request(`http://localhost/api/sources/${id}`, {
    method: "GET",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFirst.mockResolvedValue(SAMPLE_SOURCE);
});

describe("GET /api/sources/[id]", () => {
  describe("successful retrieval", () => {
    it("returns 200 with source for valid UUID", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
    });

    it("response has { item } shape", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("returns all 8 safe metadata fields", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      const item = data.item;
      expect(item.id).toBe(VALID_ID);
      expect(item.name).toBe("Manual Entry");
      expect(item.sourceType).toBe("MANUAL");
      expect(item.baseUrl).toBeNull();
      expect(item.isActive).toBe(true);
      expect(item.trustLevel).toBe("HIGH");
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });

    it("exposes baseUrl", async () => {
      mockFindFirst.mockResolvedValue({
        ...SAMPLE_SOURCE,
        baseUrl: "https://example.com",
      });

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item.baseUrl).toBe("https://example.com");
    });
  });

  describe("data exposure", () => {
    it("lastError is not returned", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).not.toHaveProperty("lastError");
    });

    it("health fields are not returned", async () => {
      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).not.toHaveProperty("lastSuccessfulCheck");
      expect(data.item).not.toHaveProperty("lastAttemptedCheck");
      expect(data.item).not.toHaveProperty("checkFrequencyMinutes");
      expect(data.item).not.toHaveProperty("consecutiveFailures");
    });
  });

  describe("not found", () => {
    it("returns 404 when source does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

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
      mockFindFirst.mockRejectedValue(new Error("DB connection failed"));

      const request = makeGetRequest(VALID_ID);
      const response = await GET(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("database error details are not leaked", async () => {
      mockFindFirst.mockRejectedValue(
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
