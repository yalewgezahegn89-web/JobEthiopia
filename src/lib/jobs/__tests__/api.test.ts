import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJobsFindMany = vi.fn();
const mockJobsFindFirst = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockInsert = vi.fn();

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
      insert: (...args: unknown[]) => mockInsert(...args),
      update: (...args: unknown[]) => mockDbUpdate(...args),
      delete: (...args: unknown[]) => mockDbDelete(...args),
    },
  };
});

vi.mock("../../../db/schema/jobs", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    slug: "jobs.slug",
    organizationId: "jobs.organizationId",
    status: "jobs.status",
    verificationStatus: "jobs.verificationStatus",
    employmentType: "jobs.employmentType",
    createdAt: "jobs.createdAt",
    updatedAt: "jobs.updatedAt",
  },
}));

import { GET } from "../../../app/api/jobs/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "../../../app/api/jobs/[id]/route";

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

    it("invalid organizationId returns 400", async () => {
      const request = makeJobListRequest({ organizationId: "not-a-uuid" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("organizationId");
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

    it("organizationId filter is passed to DB query", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const request = makeJobListRequest({ organizationId: orgId });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("organizationId combines with status", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const request = makeJobListRequest({
        organizationId: orgId,
        status: "PUBLISHED",
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("organizationId combines with employmentType", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const request = makeJobListRequest({
        organizationId: orgId,
        employmentType: "FULL_TIME",
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("organizationId combines with status and employmentType", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174000";
      const request = makeJobListRequest({
        organizationId: orgId,
        status: "PUBLISHED",
        employmentType: "FULL_TIME",
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("nonexistent organizationId returns empty results", async () => {
      mockJobsFindMany.mockResolvedValue([]);
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      const orgId = "00000000-0000-0000-0000-000000000000";
      const request = makeJobListRequest({ organizationId: orgId });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it("omitted organizationId preserves existing behavior", async () => {
      mockJobsFindMany.mockResolvedValue([SAMPLE_JOB]);
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ count: 1 }]),
      });

      const request = makeJobListRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
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

const API_KEY = "test-api-key-123";
const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

const UPDATED_JOB = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Staff Nurse",
  slug: "staff-nurse-black-lion",
  status: "PUBLISHED",
  verificationStatus: "VERIFIED",
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-20"),
};

function makePatchRequest(
  id: string,
  body: unknown,
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost/api/jobs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mockUpdateSuccess(updated: typeof UPDATED_JOB) {
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

describe("PATCH /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockJobsFindFirst.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "DRAFT",
    });
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" }, { "x-api-key": "" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" }, { "x-api-key": "wrong-key" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" }, { "x-api-key": "secret-key-value" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
    });
  });

  describe("validation", () => {
    it("invalid UUID returns 400", async () => {
      const request = makePatchRequest("not-a-uuid", { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("id");
    });

    it("malformed JSON returns 400", async () => {
      const request = new Request(`http://localhost/api/jobs/${VALID_ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: "not valid json",
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });

    it("invalid status returns 400", async () => {
      const request = makePatchRequest(VALID_ID, { status: "INVALID_STATUS" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("status");
    });

    it("invalid verificationStatus returns 400", async () => {
      const request = makePatchRequest(VALID_ID, { verificationStatus: "COMPLETELY_INVALID" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("verificationStatus");
    });
  });

  describe("not found", () => {
    it("returns 404 when job does not exist", async () => {
      mockJobsFindFirst.mockResolvedValue(null);

      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Job not found");
    });
  });

  describe("successful update", () => {
    it("valid status update returns 200", async () => {
      mockUpdateSuccess(UPDATED_JOB);

      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.status).toBe("PUBLISHED");
      expect(data.item.verificationStatus).toBe("VERIFIED");
    });

    it("valid verificationStatus update returns 200", async () => {
      mockUpdateSuccess({ ...UPDATED_JOB, verificationStatus: "VERIFIED" });

      const request = makePatchRequest(VALID_ID, { verificationStatus: "VERIFIED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.item.verificationStatus).toBe("VERIFIED");
    });

    it("response has { item } shape", async () => {
      mockUpdateSuccess(UPDATED_JOB);

      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });
  });

  describe("error handling", () => {
    it("unrelated DB error returns 500", async () => {
      mockUpdateError("DB connection failed");

      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockUpdateError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });

  describe("status transition rules", () => {
    describe("valid transitions", () => {
      it("DRAFT → PENDING_REVIEW returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "PENDING_REVIEW", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "PENDING_REVIEW" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("PENDING_REVIEW");
      });

      it("DRAFT → PUBLISHED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
        mockUpdateSuccess(UPDATED_JOB);

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("PUBLISHED");
      });

      it("DRAFT → REMOVED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "REMOVED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("REMOVED");
      });

      it("PENDING_REVIEW → DRAFT returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PENDING_REVIEW" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "DRAFT", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "DRAFT" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("DRAFT");
      });

      it("PENDING_REVIEW → PUBLISHED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PENDING_REVIEW" });
        mockUpdateSuccess(UPDATED_JOB);

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("PUBLISHED");
      });

      it("PENDING_REVIEW → REMOVED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PENDING_REVIEW" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "REMOVED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("REMOVED");
      });

      it("PUBLISHED → EXPIRED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PUBLISHED" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "EXPIRED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "EXPIRED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("EXPIRED");
      });

      it("PUBLISHED → REMOVED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PUBLISHED" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "REMOVED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("REMOVED");
      });

      it("EXPIRED → REMOVED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "EXPIRED" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "REMOVED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("REMOVED");
      });
    });

    describe("invalid transitions", () => {
      it("PUBLISHED → DRAFT returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PUBLISHED" });

        const request = makePatchRequest(VALID_ID, { status: "DRAFT" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from PUBLISHED to DRAFT");
      });

      it("PUBLISHED → PENDING_REVIEW returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PUBLISHED" });

        const request = makePatchRequest(VALID_ID, { status: "PENDING_REVIEW" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from PUBLISHED to PENDING_REVIEW");
      });

      it("EXPIRED → PUBLISHED returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "EXPIRED" });

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from EXPIRED to PUBLISHED");
      });

      it("EXPIRED → DRAFT returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "EXPIRED" });

        const request = makePatchRequest(VALID_ID, { status: "DRAFT" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from EXPIRED to DRAFT");
      });

      it("EXPIRED → PENDING_REVIEW returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "EXPIRED" });

        const request = makePatchRequest(VALID_ID, { status: "PENDING_REVIEW" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from EXPIRED to PENDING_REVIEW");
      });

      it("REMOVED → PUBLISHED returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from REMOVED to PUBLISHED");
      });

      it("REMOVED → DRAFT returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });

        const request = makePatchRequest(VALID_ID, { status: "DRAFT" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from REMOVED to DRAFT");
      });

      it("REMOVED → EXPIRED returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });

        const request = makePatchRequest(VALID_ID, { status: "EXPIRED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from REMOVED to EXPIRED");
      });

      it("DRAFT → EXPIRED returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });

        const request = makePatchRequest(VALID_ID, { status: "EXPIRED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from DRAFT to EXPIRED");
      });

      it("invalid transition does not call DB update", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });

        expect(mockDbUpdate).not.toHaveBeenCalled();
      });
    });

    describe("same-status updates", () => {
      it("PUBLISHED → PUBLISHED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "PUBLISHED" });
        mockUpdateSuccess(UPDATED_JOB);

        const request = makePatchRequest(VALID_ID, { status: "PUBLISHED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("PUBLISHED");
      });

      it("DRAFT → DRAFT returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "DRAFT", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "DRAFT" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("DRAFT");
      });

      it("REMOVED → REMOVED returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: undefined as never });

        const request = makePatchRequest(VALID_ID, { status: "REMOVED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("REMOVED");
      });
    });

    describe("verificationStatus independence", () => {
      it("verificationStatus-only update works from any status", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });
        mockUpdateSuccess({ ...UPDATED_JOB, status: "REMOVED", verificationStatus: "VERIFIED" });

        const request = makePatchRequest(VALID_ID, { verificationStatus: "VERIFIED" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.verificationStatus).toBe("VERIFIED");
      });

      it("combined valid status + verificationStatus returns 200", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
        mockUpdateSuccess(UPDATED_JOB);

        const request = makePatchRequest(VALID_ID, {
          status: "PUBLISHED",
          verificationStatus: "VERIFIED",
        });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.item.status).toBe("PUBLISHED");
        expect(data.item.verificationStatus).toBe("VERIFIED");
      });

      it("combined invalid status + verificationStatus returns 409", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "REMOVED" });

        const request = makePatchRequest(VALID_ID, {
          status: "PUBLISHED",
          verificationStatus: "VERIFIED",
        });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe("Invalid status transition from REMOVED to PUBLISHED");
      });
    });

    describe("error response shape", () => {
      it("invalid transition response has exact expected error", async () => {
        mockJobsFindFirst.mockResolvedValue({ id: VALID_ID, status: "EXPIRED" });

        const request = makePatchRequest(VALID_ID, { status: "PENDING_REVIEW" });
        const response = await PATCH(request, {
          params: Promise.resolve({ id: VALID_ID }),
        });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data).toEqual({
          error: "Invalid status transition from EXPIRED to PENDING_REVIEW",
    });
  });
});

function makeDeleteRequest(
  id: string,
  headers?: Record<string, string>,
): Request {
  return new Request(`http://localhost/api/jobs/${id}`, {
    method: "DELETE",
    headers: {
      "x-api-key": API_KEY,
      ...headers,
    },
  });
}

function mockDeleteSuccess() {
  mockDbDelete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
}

describe("DELETE /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    mockJobsFindFirst.mockResolvedValue({ id: VALID_ID });
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
      expect(data.error).toContain("id");
    });
  });

  describe("not found", () => {
    it("returns 404 when job does not exist", async () => {
      mockJobsFindFirst.mockResolvedValue(null);

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Job not found");
    });
  });

  describe("successful delete", () => {
    it("deletes existing job returns 200", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("response is exactly { success: true }", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(data).toEqual({ success: true });
    });

    it("delete is called with correct job ID", async () => {
      mockDeleteSuccess();

      const request = makeDeleteRequest(VALID_ID);
      await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });

      expect(mockDbDelete).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("database error returns 500", async () => {
      mockJobsFindFirst.mockResolvedValue({ id: VALID_ID });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      });

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("DB error details are not leaked", async () => {
      mockJobsFindFirst.mockResolvedValue({ id: VALID_ID });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockRejectedValue(
          new Error("SECRET_DB_PASSWORD=xyz connection refused"),
        ),
      });

      const request = makeDeleteRequest(VALID_ID);
      const response = await DELETE(request, {
        params: Promise.resolve({ id: VALID_ID }),
      });
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});
  });
});

const CREATED_JOB = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  title: "Software Engineer",
  slug: "software-engineer",
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
  categoryId: null,
  professionId: null,
  locationId: null,
  description: "A software engineering role",
  responsibilities: null,
  requirements: null,
  educationRequirements: null,
  benefits: null,
  experienceMin: null,
  experienceMax: null,
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
  postedAt: null,
  deadline: null,
  applicationUrl: null,
  status: "DRAFT",
  verificationStatus: "PENDING",
  firstSeenAt: new Date("2026-08-28"),
  lastVerifiedAt: null,
  createdAt: new Date("2026-08-28"),
  updatedAt: new Date("2026-08-28"),
};

const CREATED_JOB_ALL_FIELDS = {
  id: "660e8400-e29b-41d4-a716-446655440002",
  title: "Senior Software Engineer",
  slug: "senior-software-engineer",
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
  categoryId: "110e8400-e29b-41d4-a716-446655440010",
  professionId: "110e8400-e29b-41d4-a716-446655440011",
  locationId: "110e8400-e29b-41d4-a716-446655440012",
  description: "A senior software engineering role",
  responsibilities: "Lead team",
  requirements: "5+ years experience",
  educationRequirements: "BS in CS",
  benefits: "Health insurance",
  experienceMin: 5,
  experienceMax: 10,
  employmentType: "FULL_TIME",
  salaryMin: "50000",
  salaryMax: "100000",
  salaryCurrency: "USD",
  salaryPeriod: "YEARLY",
  postedAt: new Date("2026-08-01"),
  deadline: new Date("2026-09-01"),
  applicationUrl: "https://example.com/apply",
  status: "DRAFT",
  verificationStatus: "PENDING",
  firstSeenAt: new Date("2026-08-28"),
  lastVerifiedAt: null,
  createdAt: new Date("2026-08-28"),
  updatedAt: new Date("2026-08-28"),
};

function mockInsertSuccess(job: Record<string, unknown>) {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([job]),
    }),
  });
}

function mockInsertSlugConflict(job: Record<string, unknown>) {
  let callCount = 0;
  mockInsert.mockImplementation(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([]);
        }
        return Promise.resolve([job]);
      }),
    }),
  }));
}

function mockInsertAllFail() {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  });
}

function mockInsertDbError(errorMessage: string) {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue(new Error(errorMessage)),
    }),
  });
}

function makePostRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const VALID_POST_BODY = {
  title: "Software Engineer",
  slug: "software-engineer",
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
  description: "A software engineering role",
};

describe("POST /api/jobs", () => {
  let POST: typeof import("../../../app/api/jobs/route").POST;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_API_KEY", API_KEY);
    const mod = await import("../../../app/api/jobs/route");
    POST = mod.POST;
  });

  describe("authentication", () => {
    it("missing API key returns 401", async () => {
      const request = makePostRequest(VALID_POST_BODY, { "x-api-key": "" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("invalid API key returns 401", async () => {
      const request = makePostRequest(VALID_POST_BODY, { "x-api-key": "wrong-key" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("missing API key configuration returns 500", async () => {
      vi.stubEnv("INGESTION_API_KEY", undefined);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("API key not configured");
    });

    it("API key is not reflected in error response", async () => {
      const request = makePostRequest(VALID_POST_BODY, { "x-api-key": "secret-key-value" });
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("secret-key-value");
    });
  });

  describe("validation", () => {
    it("missing title returns 400", async () => {
      const request = makePostRequest({
        slug: "test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("title");
    });

    it("missing slug returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("missing organizationId returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("organizationId");
    });

    it("missing description returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("description");
    });

    it("invalid organizationId UUID returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        organizationId: "not-a-uuid",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("organizationId");
    });

    it("invalid optional FK UUID returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        categoryId: "not-a-uuid",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("categoryId");
    });

    it("invalid slug format returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "INVALID SLUG!",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        description: "desc",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("slug");
    });

    it("salaryMax < salaryMin returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        description: "desc",
        salaryMin: 50000,
        salaryMax: 30000,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("salaryMax");
    });

    it("experienceMax < experienceMin returns 400", async () => {
      const request = makePostRequest({
        title: "Test",
        slug: "test",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        description: "desc",
        experienceMin: 5,
        experienceMax: 2,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("experienceMax");
    });
  });

  describe("successful creation", () => {
    it("required fields only returns 201", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item).toBeDefined();
      expect(data.item.title).toBe("Software Engineer");
      expect(data.item.slug).toBe("software-engineer");
    });

    it("all supported optional fields returns 201", async () => {
      mockInsertSuccess(CREATED_JOB_ALL_FIELDS);

      const request = makePostRequest({
        title: "Senior Software Engineer",
        slug: "senior-software-engineer",
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        categoryId: "110e8400-e29b-41d4-a716-446655440010",
        professionId: "110e8400-e29b-41d4-a716-446655440011",
        locationId: "110e8400-e29b-41d4-a716-446655440012",
        description: "A senior software engineering role",
        responsibilities: "Lead team",
        requirements: "5+ years experience",
        educationRequirements: "BS in CS",
        benefits: "Health insurance",
        experienceMin: 5,
        experienceMax: 10,
        employmentType: "FULL_TIME",
        salaryMin: 50000,
        salaryMax: 100000,
        salaryCurrency: "USD",
        salaryPeriod: "YEARLY",
        postedAt: "2026-08-01T00:00:00.000Z",
        deadline: "2026-09-01T00:00:00.000Z",
        applicationUrl: "https://example.com/apply",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.title).toBe("Senior Software Engineer");
      expect(data.item.categoryId).toBe("110e8400-e29b-41d4-a716-446655440010");
      expect(data.item.professionId).toBe("110e8400-e29b-41d4-a716-446655440011");
      expect(data.item.locationId).toBe("110e8400-e29b-41d4-a716-446655440012");
      expect(data.item.employmentType).toBe("FULL_TIME");
      expect(data.item.salaryPeriod).toBe("YEARLY");
    });

    it("response is exactly shaped as { item: ... }", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(Object.keys(data)).toEqual(["item"]);
    });

    it("status defaults to DRAFT", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.status).toBe("DRAFT");
    });

    it("verificationStatus defaults to PENDING", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.verificationStatus).toBe("PENDING");
    });

    it("correct organizationId is inserted", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.organizationId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("optional FK fields are null when omitted", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.categoryId).toBeNull();
      expect(data.item.professionId).toBeNull();
      expect(data.item.locationId).toBeNull();
    });

    it("created job is returned with all fields", async () => {
      mockInsertSuccess(CREATED_JOB);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(data.item.id).toBeDefined();
      expect(data.item.title).toBeDefined();
      expect(data.item.slug).toBeDefined();
      expect(data.item.organizationId).toBeDefined();
      expect(data.item.description).toBeDefined();
      expect(data.item.status).toBeDefined();
      expect(data.item.verificationStatus).toBeDefined();
      expect(data.item.createdAt).toBeDefined();
      expect(data.item.updatedAt).toBeDefined();
    });
  });

  describe("database", () => {
    it("nonexistent organizationId is handled safely", async () => {
      mockInsertDbError(
        'insert or update on table "jobs" violates foreign key constraint',
      );

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("slug collision retries succeed on second attempt", async () => {
      const retryJob = { ...CREATED_JOB, slug: "software-engineer-1" };
      mockInsertSlugConflict(retryJob);

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.item.slug).toBe("software-engineer-1");
    });

    it("retries are bounded to MAX_SLUG_RETRIES + 1 attempts", async () => {
      mockInsertAllFail();

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);

      expect(response.status).toBe(409);
      expect(mockInsert).toHaveBeenCalledTimes(11);
    });

    it("exhausted slug retries returns 409", async () => {
      mockInsertAllFail();

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Job slug already exists");
    });

    it("DB error returns 500", async () => {
      mockInsertDbError("DB connection failed");

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("raw DB error details are not leaked", async () => {
      mockInsertDbError("SECRET_DB_PASSWORD=xyz connection refused");

      const request = makePostRequest(VALID_POST_BODY);
      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });

    it("malformed JSON body returns 400", async () => {
      const request = new Request("http://localhost/api/jobs", {
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
});
