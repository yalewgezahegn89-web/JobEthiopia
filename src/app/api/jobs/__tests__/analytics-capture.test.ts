import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  queryFindMany: vi.fn(),
  queryJobsFindMany: vi.fn(),
  queryJobsFindFirst: vi.fn(),
  selectRows: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      jobs: {
        findMany: (...args: unknown[]) => mocks.queryJobsFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.queryJobsFindFirst(...args),
      },
      organizations: {
        findMany: (...args: unknown[]) => mocks.queryFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.queryFindMany(...args),
      },
      categories: {
        findMany: (...args: unknown[]) => mocks.queryFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.queryFindMany(...args),
      },
      professions: {
        findMany: (...args: unknown[]) => mocks.queryFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.queryFindMany(...args),
      },
      locations: {
        findMany: (...args: unknown[]) => mocks.queryFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.queryFindMany(...args),
      },
    },
    select: () => {
      const built = {
        from: () => built,
        where: () => built,
        groupBy: () => built,
        orderBy: () => built,
        limit: () => built,
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(mocks.selectRows()).then(onFulfilled),
      };
      return built;
    },
    insert: () => ({
      values: (...args: unknown[]) => mocks.insertValues(...args),
    }),
  },
}));

import { GET } from "../route";
import { GET as GET_BY_ID } from "../[id]/route";

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

function listRequest(url: string): Request {
  return new Request(`http://localhost${url}`);
}

function detailArgs(id: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/jobs/${id}`),
    { params: Promise.resolve({ id }) },
  ];
}

const PUBLISHED_JOB = {
  id: JOB_ID,
  status: "PUBLISHED",
  organizationId: null,
  categoryId: null,
  professionId: null,
  locationId: null,
  lastVerifiedAt: "2026-09-01T00:00:00.000Z",
  deadline: "2030-12-31T00:00:00.000Z",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queryFindMany.mockResolvedValue([]);
  mocks.queryJobsFindMany.mockResolvedValue([]);
  mocks.queryJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
  mocks.selectRows.mockResolvedValue([{ count: 5 }]);
  mocks.insertValues.mockResolvedValue(undefined);
});

describe("GET /api/jobs discovery events", () => {
  it("records job_list_viewed for a plain browse", async () => {
    const response = await GET(listRequest("/api/jobs"));
    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      event: "job_list_viewed",
      jobId: null,
      locale: "en",
      metadata: { page: 1 },
    });
  });

  it("records job_search with bounded metadata for filtered/list requests", async () => {
    const response = await GET(
      listRequest("/api/jobs?employmentType=FULL_TIME&page=2"),
    );
    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      event: "job_search",
      jobId: null,
      locale: "en",
      metadata: {
        hasQuery: false,
        hasCategory: false,
        hasProfession: false,
        hasLocation: false,
        hasEmploymentType: true,
        hasOrganization: false,
        resultCount: 5,
        page: 2,
      },
    });
  });

  it("records job_search for keyword queries without storing the query text", async () => {
    const response = await GET(listRequest("/api/jobs?q=engineer"));
    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    const stored = mocks.insertValues.mock.calls[0][0] as {
      event: string;
      metadata: Record<string, unknown>;
    };
    expect(stored.event).toBe("job_search");
    expect(stored.metadata.hasQuery).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("engineer");
  });

  it("keeps the 200 response when the analytics insert fails", async () => {
    mocks.insertValues.mockRejectedValue(new Error("db down"));
    const response = await GET(listRequest("/api/jobs"));
    expect(response.status).toBe(200);
  });
});

describe("GET /api/jobs/[id] discovery events", () => {
  it("records job_viewed with the job id for a public job detail", async () => {
    const response = await GET_BY_ID(...detailArgs(JOB_ID));
    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenCalledWith({
      event: "job_viewed",
      jobId: JOB_ID,
      locale: "en",
      metadata: {},
    });
  });

  it("does not record a view for a missing job", async () => {
    mocks.queryJobsFindFirst.mockResolvedValue(undefined);
    const response = await GET_BY_ID(...detailArgs(JOB_ID));
    expect(response.status).toBe(404);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});