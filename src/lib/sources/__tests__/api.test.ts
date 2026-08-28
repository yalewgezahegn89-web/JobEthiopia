import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
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

import { GET, POST } from "../../../app/api/sources/route";

const SAMPLE_SOURCE = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Manual Entry",
  sourceType: "MANUAL",
  baseUrl: null,
  isActive: true,
  trustLevel: "HIGH",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
};

function makeGetRequest(searchParams?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/sources");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

function mockDbSuccess(count: number, items: unknown[]) {
  let callCount = 0;
  mockDbSelect.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count }]),
        }),
      };
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(items),
            }),
          }),
        }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSuccess(1, [SAMPLE_SOURCE]);
});

describe("GET /api/sources", () => {
  describe("successful listing", () => {
    it("returns 200 with source items", async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Manual Entry");
    });

    it("default page is 1", async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
    });

    it("default limit is 20", async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(20);
    });

    it("custom page works", async () => {
      const request = makeGetRequest({ page: "2" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(2);
    });

    it("custom limit works", async () => {
      const request = makeGetRequest({ limit: "5" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
    });

    it("pagination offset is correct", async () => {
      let offsetValue: number | undefined;
      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 1 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockImplementation((val: number) => {
                    offsetValue = val;
                    return Promise.resolve([SAMPLE_SOURCE]);
                  }),
                }),
              }),
            }),
          }),
        };
      });

      const request = makeGetRequest({ page: "3", limit: "10" });
      await GET(request);

      expect(offsetValue).toBe(20);
    });
  });

  describe("filtering", () => {
    it("isActive=true filter works", async () => {
      const request = makeGetRequest({ isActive: "true" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("isActive=false filter works", async () => {
      const request = makeGetRequest({ isActive: "false" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("sourceType filter works", async () => {
      const request = makeGetRequest({ sourceType: "MANUAL" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("combined filters work", async () => {
      const request = makeGetRequest({
        isActive: "true",
        sourceType: "MANUAL",
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("validation", () => {
    it("invalid sourceType returns 400", async () => {
      const request = makeGetRequest({ sourceType: "INVALID" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceType");
    });

    it("page < 1 returns 400", async () => {
      const request = makeGetRequest({ page: "0" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("page");
    });

    it("limit < 1 returns 400", async () => {
      const request = makeGetRequest({ limit: "0" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("limit");
    });

    it("limit > 100 returns 400", async () => {
      const request = makeGetRequest({ limit: "101" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("limit");
    });
  });

  describe("empty results", () => {
    it("empty result returns valid pagination", async () => {
      mockDbSuccess(0, []);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("database error details are not leaked", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("SECRET_DB_PASSWORD=xyz connection refused");
      });

      const request = makeGetRequest();
      const response = await GET(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });

  describe("data exposure", () => {
    it("response does NOT contain lastError", async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0]).not.toHaveProperty("lastError");
    });

    it("response does NOT contain health fields", async () => {
      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0]).not.toHaveProperty("lastSuccessfulCheck");
      expect(data.items[0]).not.toHaveProperty("lastAttemptedCheck");
      expect(data.items[0]).not.toHaveProperty("checkFrequencyMinutes");
      expect(data.items[0]).not.toHaveProperty("consecutiveFailures");
    });
  });
});

const CREATED_SOURCE = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  name: "Website Scraper",
  sourceType: "WEBSITE",
  baseUrl: "https://example.com",
  isActive: true,
  trustLevel: "MEDIUM",
  createdAt: new Date("2026-01-20"),
  updatedAt: new Date("2026-01-20"),
};

const API_KEY = "test-api-key-123";

function makePostRequest(
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mockInsertSuccess(created: typeof CREATED_SOURCE) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([created]),
    }),
  });
}

function mockInsertError(errorMessage: string) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue(new Error(errorMessage)),
    }),
  });
}

describe("POST /api/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePostRequest(
        { name: "Test", sourceType: "MANUAL" },
        { "x-api-key": "" },
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePostRequest(
        { name: "Test", sourceType: "MANUAL" },
        { "x-api-key": "wrong-key" },
      );
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePostRequest(
        { name: "Test", sourceType: "MANUAL" },
        { "x-api-key": "secret-key-value" },
      );
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
    });
  });

  describe("successful creation", () => {
    it("valid minimal body returns 201", async () => {
      mockInsertSuccess(CREATED_SOURCE);

      const request = makePostRequest({
        name: "Website Scraper",
        sourceType: "WEBSITE",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item).toBeDefined();
      expect(data.item.name).toBe("Website Scraper");
    });

    it("valid full body returns 201", async () => {
      mockInsertSuccess({
        ...CREATED_SOURCE,
        trustLevel: "LOW",
        isActive: false,
      });

      const request = makePostRequest({
        name: "Website Scraper",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        isActive: false,
        trustLevel: "LOW",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.baseUrl).toBe("https://example.com");
      expect(data.item.trustLevel).toBe("LOW");
    });

    it("response contains { item } shape", async () => {
      mockInsertSuccess(CREATED_SOURCE);

      const request = makePostRequest({
        name: "Website Scraper",
        sourceType: "WEBSITE",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });
  });

  describe("validation", () => {
    it("missing name returns 400", async () => {
      const request = makePostRequest({ sourceType: "MANUAL" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("name");
    });

    it("missing sourceType returns 400", async () => {
      const request = makePostRequest({ name: "Test" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceType");
    });

    it("invalid sourceType returns 400", async () => {
      const request = makePostRequest({
        name: "Test",
        sourceType: "INVALID",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceType");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request("http://localhost/api/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: "not valid json",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });
  });

  describe("duplicate name handling", () => {
    it("duplicate name returns 409", async () => {
      mockInsertError("duplicate key value violates unique constraint \"sources_name_unique\"");

      const request = makePostRequest({
        name: "Manual Entry",
        sourceType: "MANUAL",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Source name already exists");
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockInsertError("DB connection failed");

      const request = makePostRequest({
        name: "Test",
        sourceType: "MANUAL",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockInsertError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePostRequest({
        name: "Test",
        sourceType: "MANUAL",
      });
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });

  describe("data exposure", () => {
    it("response contains only safe source fields", async () => {
      mockInsertSuccess(CREATED_SOURCE);

      const request = makePostRequest({
        name: "Website Scraper",
        sourceType: "WEBSITE",
      });
      const response = await POST(request);
      const data = await response.json();

      const item = data.item;
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("sourceType");
      expect(item).toHaveProperty("baseUrl");
      expect(item).toHaveProperty("isActive");
      expect(item).toHaveProperty("trustLevel");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("updatedAt");
    });

    it("health fields are absent from response", async () => {
      mockInsertSuccess(CREATED_SOURCE);

      const request = makePostRequest({
        name: "Website Scraper",
        sourceType: "WEBSITE",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.item).not.toHaveProperty("lastError");
      expect(data.item).not.toHaveProperty("lastSuccessfulCheck");
      expect(data.item).not.toHaveProperty("lastAttemptedCheck");
      expect(data.item).not.toHaveProperty("checkFrequencyMinutes");
      expect(data.item).not.toHaveProperty("consecutiveFailures");
    });
  });
});
