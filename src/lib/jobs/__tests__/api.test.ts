import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJobsFindMany = vi.fn();
const mockJobsFindFirst = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();

vi.mock("../../../db", () => {
  const chainable = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  return {
    db: {
      query: {
        jobs: {
          findMany: (...args: unknown[]) => mockJobsFindMany(...args),
          findFirst: (...args: unknown[]) => mockJobsFindFirst(...args),
        },
      },
      select: (...args: unknown[]) => {
        mockDbSelect(...args);
        return {
          from: (...fromArgs: unknown[]) => {
            mockDbFrom(...fromArgs);
            return {
              where: (...whereArgs: unknown[]) => {
                mockDbWhere(...whereArgs);
                return chainable;
              },
            };
          },
        };
      },
    },
  };
});

vi.mock("../../../db/schema/jobs", () => ({
  jobs: {
    id: "jobs.id",
    status: "jobs.status",
    employmentType: "jobs.employmentType",
    createdAt: "jobs.createdAt",
  },
}));

import { GET } from "../../../app/api/jobs/route";
import { GET as GET_BY_ID } from "../../../app/api/jobs/[id]/route";

const SAMPLE_JOB = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Staff Nurse",
  slug: "staff-nurse-black-lion",
  organizationId: "org-1",
  description: "Nursing role at hospital",
  status: "DRAFT",
  employmentType: "FULL_TIME",
  createdAt: new Date("2026-01-15"),
};

function makeGetRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

function makeJobListRequest(
  searchParams?: Record<string, string>,
): Request {
  const url = new URL("http://localhost/api/jobs");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();

  mockJobsFindMany.mockResolvedValue([SAMPLE_JOB]);
  mockJobsFindFirst.mockResolvedValue(SAMPLE_JOB);

  const countChain = {
    where: vi.fn().mockResolvedValue([{ count: 1 }]),
  };
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue(countChain),
  });
  mockDbWhere.mockReturnValue({
    where: vi.fn().mockResolvedValue([{ count: 1 }]),
  });
});

describe("GET /api/jobs", () => {
  describe("successful listing", () => {
    it("returns jobs successfully", async () => {
      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].title).toBe("Staff Nurse");
    });

    it("returns pagination metadata", async () => {
      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.totalPages).toBeDefined();
    });

    it("default page is 1", async () => {
      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
    });

    it("default limit is applied", async () => {
      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(20);
    });

    it("custom page works", async () => {
      const request = makeJobListRequest({ page: "2" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(2);
    });

    it("custom limit works", async () => {
      const request = makeJobListRequest({ limit: "5" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
    });
  });

  describe("validation", () => {
    it("limit above 100 returns 400", async () => {
      const request = makeJobListRequest({ limit: "101" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("limit");
    });

    it("page below 1 returns 400", async () => {
      const request = makeJobListRequest({ page: "0" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("page");
    });

    it("invalid status returns 400", async () => {
      const request = makeJobListRequest({ status: "INVALID_STATUS" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });

    it("invalid employmentType returns 400", async () => {
      const request = makeJobListRequest({ employmentType: "INVALID" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("employmentType");
    });
  });

  describe("filtering", () => {
    it("status filter is passed to DB query", async () => {
      const request = makeJobListRequest({ status: "PUBLISHED" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("employmentType filter is passed to DB query", async () => {
      const request = makeJobListRequest({ employmentType: "FULL_TIME" });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("DB connection failed");
      });

      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("database error details are not leaked", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("SECRET_DB_PASSWORD=xyz connection refused");
      });

      const request = makeJobListRequest();
      const response = await GET(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});

describe("GET /api/jobs/[id]", () => {
  const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

  describe("successful retrieval", () => {
    it("returns existing job", async () => {
      const request = makeGetRequest(`http://localhost/api/jobs/${VALID_ID}`);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item).toBeDefined();
      expect(data.item.id).toBe(VALID_ID);
      expect(data.item.title).toBe("Staff Nurse");
    });
  });

  describe("not found", () => {
    it("returns 404 when job does not exist", async () => {
      mockJobsFindFirst.mockResolvedValue(null);

      const request = makeGetRequest(`http://localhost/api/jobs/${VALID_ID}`);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Job not found");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makeGetRequest("http://localhost/api/jobs/not-a-uuid");
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("id");
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockJobsFindFirst.mockRejectedValue(new Error("DB connection failed"));

      const request = makeGetRequest(`http://localhost/api/jobs/${VALID_ID}`);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("database error details are not leaked", async () => {
      mockJobsFindFirst.mockRejectedValue(
        new Error("SECRET_DB_PASSWORD=xyz connection refused"),
      );

      const request = makeGetRequest(`http://localhost/api/jobs/${VALID_ID}`);
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});
