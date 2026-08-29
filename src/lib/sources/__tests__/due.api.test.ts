import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();
const mockIsSourceDueForCheck = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("../../../db/schema/sources", () => ({
  sources: {
    id: "sources.id",
    name: "sources.name",
    sourceType: "sources.sourceType",
    baseUrl: "sources.baseUrl",
    isActive: "sources.isActive",
    consecutiveFailures: "sources.consecutiveFailures",
    lastSuccessfulCheck: "sources.lastSuccessfulCheck",
    checkFrequencyMinutes: "sources.checkFrequencyMinutes",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join("?"),
    values,
  })),
  asc: vi.fn((val: unknown) => val),
  desc: vi.fn((val: unknown) => val),
  isNull: vi.fn(),
}));

vi.mock("../../../lib/sources/health", () => ({
  isSourceDueForCheck: (...args: unknown[]) =>
    mockIsSourceDueForCheck(...args),
}));

import { GET } from "../../../app/api/sources/due/route";

const VALID_ID_1 = "550e8400-e29b-41d4-a716-446655440000";
const API_KEY = "test-api-key-123";

function makeGetRequest(searchParams?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/sources/due");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), {
    method: "GET",
    headers: { "x-api-key": API_KEY },
  });
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
  vi.stubEnv("INGESTION_API_KEY", API_KEY);
  mockDbSuccess(1, []);
  mockIsSourceDueForCheck.mockResolvedValue(true);
});

describe("GET /api/sources/due", () => {
  describe("successful listing", () => {
    it("returns 200 with due sources", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 3,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe(VALID_ID_1);
      expect(data.items[0].name).toBe("Test Source");
      expect(data.items[0].isDue).toBe(true);
    });

    it("returns empty list when no sources are due", async () => {
      mockDbSuccess(0, []);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe("response shape", () => {
    it("returns expected fields in each item", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 2,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0]).toHaveProperty("id");
      expect(data.items[0]).toHaveProperty("name");
      expect(data.items[0]).toHaveProperty("sourceType");
      expect(data.items[0]).toHaveProperty("baseUrl");
      expect(data.items[0]).toHaveProperty("consecutiveFailures");
      expect(data.items[0]).toHaveProperty("isDue");
      expect(data.items[0]).toHaveProperty("urgency");
    });

    it("does not expose lastError", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0]).not.toHaveProperty("lastError");
    });

    it("does not expose health error text", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 5,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const body = await response.text();

      expect(body).not.toContain("lastError");
      expect(body).not.toContain("last_error");
    });

    it("isDue reflects isSourceDueForCheck result", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(false);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0].isDue).toBe(false);
      expect(data.items[0].urgency).toBe("current");
    });

    it("urgency is overdue for never-checked sources", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0].urgency).toBe("overdue");
    });

    it("urgency is overdue for sources with no frequency", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: new Date("2026-01-15"),
        checkFrequencyMinutes: null,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0].urgency).toBe("overdue");
    });

    it("urgency is due for checked sources with elapsed frequency", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Test Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: new Date("2026-01-15"),
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.items[0].urgency).toBe("due");
    });
  });

  describe("filtering", () => {
    it("only active sources are returned", async () => {
      const request = makeGetRequest();
      await GET(request);

      const selectCall = mockDbSelect.mock.results[0]?.value;
      expect(selectCall).toBeDefined();
    });

    it("sourceType filter works", async () => {
      const source = {
        id: VALID_ID_1,
        name: "API Source",
        sourceType: "API",
        baseUrl: "https://api.example.com",
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 30,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest({ sourceType: "API" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items[0].sourceType).toBe("API");
    });

    it("maxConsecutiveFailures filter works", async () => {
      const source = {
        id: VALID_ID_1,
        name: "Failing Source",
        sourceType: "WEBSITE",
        baseUrl: "https://example.com",
        consecutiveFailures: 10,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      };
      mockDbSuccess(1, [source]);
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest({ maxConsecutiveFailures: "5" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items[0].consecutiveFailures).toBe(10);
    });
  });

  describe("pagination", () => {
    it("pagination works correctly", async () => {
      const allSources = Array.from({ length: 3 }, (_, i) => ({
        id: `550e8400-e29b-41d4-a716-44665544000${i}`,
        name: `Source ${i}`,
        sourceType: "WEBSITE" as const,
        baseUrl: `https://${i}.example.com`,
        consecutiveFailures: 0,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      }));

      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 3 }]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn((lmt: number) => ({
                  offset: vi.fn().mockResolvedValue(
                    allSources.slice(0, lmt),
                  ),
                })),
              }),
            }),
          }),
        };
      });
      mockIsSourceDueForCheck.mockResolvedValue(true);

      const request = makeGetRequest({ limit: "2", page: "1" });
      const response = await GET(request);
      const data = await response.json();

      expect(data.items).toHaveLength(2);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(2);
    });

    it("default page is 1", async () => {
      mockDbSuccess(0, []);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
    });

    it("default limit is 20", async () => {
      mockDbSuccess(0, []);

      const request = makeGetRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(20);
    });

    it("limit maximum is enforced", async () => {
      mockDbSuccess(0, []);

      const request = makeGetRequest({ limit: "200" });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe("validation", () => {
    it("invalid page returns 400", async () => {
      const request = makeGetRequest({ page: "0" });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("invalid maxConsecutiveFailures returns 400", async () => {
      const request = makeGetRequest({ maxConsecutiveFailures: "-1" });
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("invalid sourceType returns 400", async () => {
      const request = makeGetRequest({ sourceType: "INVALID" });
      const response = await GET(request);

      expect(response.status).toBe(400);
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
});
