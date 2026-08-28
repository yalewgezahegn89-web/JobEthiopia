import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJobsFindMany = vi.fn();
const mockJobsFindFirst = vi.fn();
const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

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
