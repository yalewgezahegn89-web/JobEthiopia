import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();

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
    trustLevel: "sources.trustLevel",
    createdAt: "sources.createdAt",
    updatedAt: "sources.updatedAt",
  },
}));

import { GET } from "../../../app/api/sources/route";

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
