import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock("../../../db/schema/sources", () => ({
  sources: {
    id: "sources.id",
    name: "sources.name",
    sourceType: "sources.sourceType",
    baseUrl: "sources.baseUrl",
    isActive: "sources.isActive",
    trustLevel: "sources.trustLevel",
    createdAt: "sources.createdAt",
    updatedAt: "sources.updatedAt",
  },
}));

import { GET, PUT, DELETE } from "../../../app/api/sources/[id]/route";

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

const API_KEY = "test-api-key-123";

const UPDATED_SOURCE = {
  id: VALID_ID,
  name: "Updated Source",
  sourceType: "API",
  baseUrl: "https://updated.example.com" as string | null,
  isActive: false,
  trustLevel: "LOW",
  createdAt: new Date("2026-01-15T00:00:00Z"),
  updatedAt: new Date("2026-01-20T00:00:00Z"),
};

function makePutRequest(
  id: string,
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost/api/sources/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mockUpdateSuccess(updated: typeof UPDATED_SOURCE) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updated]),
      }),
    }),
  });
}

function mockUpdateError(errorMessage: string) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error(errorMessage)),
      }),
    }),
  });
}

describe("PUT /api/sources/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockFindFirst.mockResolvedValue({ id: VALID_ID });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePutRequest(VALID_ID, { name: "Test" }, { "x-api-key": "" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePutRequest(VALID_ID, { name: "Test" }, { "x-api-key": "wrong-key" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePutRequest(VALID_ID, { name: "Test" }, { "x-api-key": "secret-key-value" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makePutRequest("not-a-uuid", { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid source ID");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(`http://localhost/api/sources/${VALID_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: "not valid json",
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });

    it("invalid sourceType returns 400", async () => {
      const request = makePutRequest(VALID_ID, { sourceType: "INVALID" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceType");
    });

    it("invalid trustLevel returns 400", async () => {
      const request = makePutRequest(VALID_ID, { trustLevel: "INVALID" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("trustLevel");
    });

    it("empty name returns 400", async () => {
      const request = makePutRequest(VALID_ID, { name: "" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("invalid baseUrl returns 400", async () => {
      const request = makePutRequest(VALID_ID, { baseUrl: "not-a-url" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("baseUrl");
    });
  });

  describe("not found", () => {
    it("returns 404 when source does not exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });
  });

  describe("successful update", () => {
    it("valid full update returns 200", async () => {
      mockUpdateSuccess(UPDATED_SOURCE);

      const request = makePutRequest(VALID_ID, {
        name: "Updated Source",
        sourceType: "API",
        baseUrl: "https://updated.example.com",
        isActive: false,
        trustLevel: "LOW",
      });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("Updated Source");
      expect(data.item.sourceType).toBe("API");
      expect(data.item.baseUrl).toBe("https://updated.example.com");
      expect(data.item.isActive).toBe(false);
      expect(data.item.trustLevel).toBe("LOW");
    });

    it("partial name update returns 200", async () => {
      mockUpdateSuccess({ ...UPDATED_SOURCE, name: "Renamed" });

      const request = makePutRequest(VALID_ID, { name: "Renamed" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.name).toBe("Renamed");
    });

    it("partial baseUrl=null update returns 200", async () => {
      mockUpdateSuccess({ ...UPDATED_SOURCE, baseUrl: null });

      const request = makePutRequest(VALID_ID, { baseUrl: null });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.baseUrl).toBeNull();
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(UPDATED_SOURCE);

      const request = makePutRequest(VALID_ID, { name: "Updated" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });
  });

  describe("duplicate name", () => {
    it("duplicate name returns 409", async () => {
      mockUpdateError(
        'duplicate key value violates unique constraint "sources_name_unique"',
      );

      const request = makePutRequest(VALID_ID, { name: "Existing Name" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Source name already exists");
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockUpdateError("DB connection failed");

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockUpdateError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePutRequest(VALID_ID, { name: "Test" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });

  describe("data exposure", () => {
    it("response contains only safe fields", async () => {
      mockUpdateSuccess(UPDATED_SOURCE);

      const request = makePutRequest(VALID_ID, { name: "Updated" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      const item = data.item;
      expect(Object.keys(item).sort()).toEqual([
        "baseUrl",
        "createdAt",
        "id",
        "isActive",
        "name",
        "sourceType",
        "trustLevel",
        "updatedAt",
      ]);
    });

    it("health fields and lastError are absent from response", async () => {
      mockUpdateSuccess(UPDATED_SOURCE);

      const request = makePutRequest(VALID_ID, { name: "Updated" });
      const response = await PUT(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data.item).not.toHaveProperty("lastError");
      expect(data.item).not.toHaveProperty("lastSuccessfulCheck");
      expect(data.item).not.toHaveProperty("lastAttemptedCheck");
      expect(data.item).not.toHaveProperty("checkFrequencyMinutes");
      expect(data.item).not.toHaveProperty("consecutiveFailures");
    });
  });
});

function makeDeleteRequest(id: string, headers?: Record<string, string>): Request {
  return new Request(`http://localhost/api/sources/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockDeleteSuccess() {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

function mockDeleteError(errorMessage: string) {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockRejectedValue(new Error(errorMessage)),
  });
}

describe("DELETE /api/sources/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockFindFirst.mockResolvedValue({ id: VALID_ID });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makeDeleteRequest(VALID_ID, { "x-api-key": "" });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makeDeleteRequest(VALID_ID, { "x-api-key": "wrong-key" });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("API key is not reflected in error response", async () => {
      const request = makeDeleteRequest(VALID_ID, { "x-api-key": "secret-key-value" });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makeDeleteRequest("not-a-uuid");
      const response = await DELETE(request, {
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

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found");
    });
  });

  describe("successful deletion", () => {
    it("returns 200 with success true", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("uses correct source ID in delete", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockDbDelete).toHaveBeenCalled();
    });
  });

  describe("constraint conflict", () => {
    it("foreign key constraint returns 409", async () => {
      mockDeleteError(
        'update or delete on table "sources" violates foreign key constraint "job_sources_source_id_fkey"',
      );

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Source cannot be deleted because it is referenced by other records");
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockDeleteError("DB connection failed");

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockDeleteError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });

  describe("data safety", () => {
    it("response does not contain health fields", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("lastError");
      expect(body).not.toContain("lastSuccessfulCheck");
      expect(body).not.toContain("lastAttemptedCheck");
      expect(body).not.toContain("checkFrequencyMinutes");
      expect(body).not.toContain("consecutiveFailures");
    });
  });
});
