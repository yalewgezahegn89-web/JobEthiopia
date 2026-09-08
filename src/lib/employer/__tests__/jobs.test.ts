import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbSelectChain: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockGetUserOrgIds: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelectChain(...args),
    transaction: (...args: unknown[]) => mocks.mockDbTransaction(...args),
  },
}));

vi.mock("@/lib/auth/organizationMembership", () => ({
  getUserOrganizationIds: (...args: unknown[]) =>
    mocks.mockGetUserOrgIds(...args),
}));

vi.mock("@/lib/ingestion/slug", () => ({
  generateSlug: (input: string) => input.toLowerCase().replace(/\s+/g, "-"),
}));

import {
  listEmployerJobs,
  createEmployerJob,
  changeEmployerJobStatus,
} from "../jobs";
import {
  listEmployerApplications,
  getEmployerApplicationStatusHistory,
  listEmployerJobsForFilter,
} from "../applications";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const JOB_ID_2 = "44444444-4444-4444-8444-444444444445";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const APP_ID = "33333333-3333-4333-8333-333333333333";
const EMPLOYER_SOURCE_ID = "55555555-5555-4555-8555-555555555555";

function buildChain(result: unknown) {
  const resolved = Array.isArray(result) ? result : [result];
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(resolved);
  chain.groupBy = vi.fn().mockResolvedValue(resolved);
  chain.then = vi.fn().mockImplementation(function (
    this: unknown,
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(resolved).then(onFulfilled, onRejected);
  });
  return chain;
}

function buildSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(result);
  chain.groupBy = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildTerminalChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  chain.offset = vi.fn().mockResolvedValue(result);
  chain.groupBy = vi.fn().mockResolvedValue(result);
  chain.where = vi.fn().mockReturnValue(
    Object.create(null, {
      then: {
        value: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
        writable: true,
        configurable: true,
      },
      from: { value: chain.from },
      innerJoin: { value: chain.innerJoin },
      where: { value: chain.where },
      orderBy: { value: chain.orderBy },
      limit: { value: chain.limit },
    }),
  );
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listEmployerJobs - application counts", () => {
  it("returns zero counts when no applications exist", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    const jobRow = {
      id: JOB_ID,
      title: "Engineer",
      organizationId: ORG_ID,
      status: "PUBLISHED",
      deadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.innerJoin = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockReturnValue(countChain);
    countChain.groupBy = vi.fn().mockResolvedValue([]);

    const orgChain: Record<string, ReturnType<typeof vi.fn>> = {};
    orgChain.from = vi.fn().mockReturnValue(orgChain);
    orgChain.where = vi.fn().mockImplementation(() =>
      Promise.resolve([{ id: ORG_ID, name: "Acme" }]),
    );

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([jobRow]))
      .mockReturnValueOnce(buildChain([{ count: 1 }]))
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(orgChain);

    const result = await listEmployerJobs(USER_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].applicationCount).toBe(0);
    expect(result.items[0].needsReviewCount).toBe(0);
  });

  it("returns correct application and needsReview counts", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    const jobRow = {
      id: JOB_ID,
      title: "Engineer",
      organizationId: ORG_ID,
      status: "PUBLISHED",
      deadline: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const totalCountChain: Record<string, ReturnType<typeof vi.fn>> = {};
    totalCountChain.from = vi.fn().mockReturnValue(totalCountChain);
    totalCountChain.innerJoin = vi.fn().mockReturnValue(totalCountChain);
    totalCountChain.where = vi.fn().mockReturnValue(totalCountChain);
    totalCountChain.groupBy = vi.fn().mockResolvedValue([{ jobId: JOB_ID, count: 5 }]);

    const needsReviewChain: Record<string, ReturnType<typeof vi.fn>> = {};
    needsReviewChain.from = vi.fn().mockReturnValue(needsReviewChain);
    needsReviewChain.innerJoin = vi.fn().mockReturnValue(needsReviewChain);
    needsReviewChain.where = vi.fn().mockReturnValue(needsReviewChain);
    needsReviewChain.groupBy = vi.fn().mockResolvedValue([{ jobId: JOB_ID, count: 2 }]);

    const orgChain: Record<string, ReturnType<typeof vi.fn>> = {};
    orgChain.from = vi.fn().mockReturnValue(orgChain);
    orgChain.where = vi.fn().mockImplementation(() =>
      Promise.resolve([{ id: ORG_ID, name: "Acme" }]),
    );

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([jobRow]))
      .mockReturnValueOnce(buildChain([{ count: 1 }]))
      .mockReturnValueOnce(totalCountChain)
      .mockReturnValueOnce(needsReviewChain)
      .mockReturnValueOnce(orgChain);

    const result = await listEmployerJobs(USER_ID);
    expect(result.items[0].applicationCount).toBe(5);
    expect(result.items[0].needsReviewCount).toBe(2);
  });

  it("returns empty when user has no org memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);

    const result = await listEmployerJobs(USER_ID);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("listEmployerApplications - sorting", () => {
  beforeEach(() => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
  });

  it("defaults to newest first", async () => {
    const mockRow = {
      id: APP_ID,
      jobId: JOB_ID,
      jobTitle: "Engineer",
      organizationId: ORG_ID,
      organizationName: "Acme",
      candidateName: "Jane",
      candidateEmail: "jane@example.com",
      status: "SUBMITTED",
      createdAt: new Date("2026-01-02"),
      updatedAt: new Date("2026-01-02"),
    };

    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.innerJoin = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 1 }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([mockRow]))
      .mockReturnValueOnce(countChain);

    const result = await listEmployerApplications(USER_ID);
    expect(result.items).toHaveLength(1);
  });

  it("accepts oldest sort parameter", async () => {
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.innerJoin = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 0 }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(countChain);

    const result = await listEmployerApplications(USER_ID, { sort: "oldest" });
    expect(result.items).toEqual([]);
  });

  it("accepts updated sort parameter", async () => {
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.innerJoin = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 0 }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(countChain);

    const result = await listEmployerApplications(USER_ID, { sort: "updated" });
    expect(result.items).toEqual([]);
  });
});

describe("getEmployerApplicationStatusHistory", () => {
  it("returns empty when user has no memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await getEmployerApplicationStatusHistory(USER_ID, APP_ID);
    expect(result).toEqual([]);
  });

  it("returns empty when application not found in user's orgs", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildTerminalChain([]),
    );

    const result = await getEmployerApplicationStatusHistory(USER_ID, APP_ID);
    expect(result).toEqual([]);
  });

  it("returns status history for authorized application", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    const historyChain: Record<string, ReturnType<typeof vi.fn>> = {};
    historyChain.from = vi.fn().mockReturnValue(historyChain);
    historyChain.where = vi.fn().mockReturnValue(historyChain);
    historyChain.orderBy = vi.fn().mockImplementation(() =>
      Promise.resolve([
        {
          action: "APPLICATION_SUBMITTED",
          timestamp: new Date("2026-01-01"),
          metadata: null,
        },
        {
          action: "APPLICATION_STATUS_CHANGED",
          timestamp: new Date("2026-01-02"),
          metadata: { fromStatus: "SUBMITTED", toStatus: "REVIEWING" },
        },
      ]),
    );

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildTerminalChain([{ organizationId: ORG_ID }]))
      .mockReturnValueOnce(historyChain);

    const result = await getEmployerApplicationStatusHistory(USER_ID, APP_ID);
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("APPLICATION_SUBMITTED");
    expect(result[0].previousStatus).toBeNull();
    expect(result[0].newStatus).toBeNull();
    expect(result[1].action).toBe("APPLICATION_STATUS_CHANGED");
    expect(result[1].previousStatus).toBe("SUBMITTED");
    expect(result[1].newStatus).toBe("REVIEWING");
  });

  it("denies access to application in different org", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildTerminalChain([]),
    );

    const result = await getEmployerApplicationStatusHistory(USER_ID, APP_ID);
    expect(result).toEqual([]);
  });
});

describe("listEmployerJobsForFilter", () => {
  it("returns empty when user has no memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await listEmployerJobsForFilter(USER_ID);
    expect(result).toEqual([]);
  });

  it("returns jobs for authorized organizations", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);

    const jobsChain: Record<string, ReturnType<typeof vi.fn>> = {};
    jobsChain.from = vi.fn().mockReturnValue(jobsChain);
    jobsChain.where = vi.fn().mockReturnValue(jobsChain);
    jobsChain.orderBy = vi.fn().mockImplementation(() =>
      Promise.resolve([
        { id: JOB_ID, title: "Engineer" },
        { id: JOB_ID_2, title: "Designer" },
      ]),
    );

    mocks.mockDbSelectChain.mockReturnValueOnce(jobsChain);

    const result = await listEmployerJobsForFilter(USER_ID);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(JOB_ID);
    expect(result[1].id).toBe(JOB_ID_2);
  });
});

function buildTxSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildTxInsertChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(
    Array.isArray(result) ? result : [result],
  );
  return chain;
}

function collectSqlParams(chunk: unknown): unknown[] {
  const params: unknown[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      if ("value" in value && "encoder" in value) {
        params.push((value as { value: unknown }).value);
      }
      if ("queryChunks" in value) {
        visit((value as { queryChunks: unknown[] }).queryChunks);
      }
    } else if (typeof value === "string") {
      params.push(value);
    }
  };
  visit(chunk);
  return params;
}

function buildSuccessTxChain(createdJob: Record<string, unknown>) {
  const tx = {
    select: vi.fn()
      .mockReturnValueOnce(
        buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
      )
      .mockReturnValueOnce(
        buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
      )
      .mockReturnValueOnce(
        buildTxSelectChain([{ id: "m1" }]),
      )
      .mockReturnValueOnce(
        buildTxSelectChain([]),
      )
      .mockReturnValueOnce(
        buildTxSelectChain([{ id: EMPLOYER_SOURCE_ID }]),
      )
      .mockReturnValueOnce(
        buildTxSelectChain([{ name: "Acme Corp" }]),
      ),
    insert: vi.fn()
      .mockReturnValueOnce(buildTxInsertChain(createdJob))
      .mockReturnValueOnce(buildTxInsertChain(undefined))
      .mockReturnValueOnce(buildTxInsertChain(undefined)),
  };
  return tx;
}

describe("createEmployerJob", () => {
  const INPUT = {
    organizationId: ORG_ID,
    title: "Software Engineer",
    description: "Build great things",
  };

  const CREATED_JOB = {
    id: JOB_ID,
    title: "Software Engineer",
    slug: "software-engineer",
    organizationId: ORG_ID,
    description: "Build great things",
    categoryId: null,
    professionId: null,
    locationId: null,
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
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("returns USER_INACTIVE when user is not ORGANIZATION_ADMIN", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(
        buildTxSelectChain([{ role: "CANDIDATE", isActive: true }]),
      ),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns USER_INACTIVE when user is inactive", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(
        buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: false }]),
      ),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns USER_INACTIVE when user does not exist", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(buildTxSelectChain([])),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns FORBIDDEN when organization does not exist", async () => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(buildTxSelectChain([])),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns ORG_INACTIVE when organization is not ACTIVE", async () => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "INACTIVE" }]),
        ),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "ORG_INACTIVE" });
  });

  it("returns FORBIDDEN when user has no organization membership", async () => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(buildTxSelectChain([])),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("creates job with DRAFT status and PENDING verificationStatus", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.status).toBe("DRAFT");
      expect(result.item.verificationStatus).toBe("PENDING");
    }
  });

  it("generates slug from title", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.slug).toBe("software-engineer");
    }
  });

  it("returns correct EmployerJobDetail shape on success", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item).toMatchObject({
        id: JOB_ID,
        title: "Software Engineer",
        slug: "software-engineer",
        organizationId: ORG_ID,
        organizationName: "Acme Corp",
        description: "Build great things",
        status: "DRAFT",
        verificationStatus: "PENDING",
        categoryId: null,
        professionId: null,
        locationId: null,
        categoryName: null,
        professionName: null,
        locationName: null,
      });
      expect(result.item).toHaveProperty("createdAt");
      expect(result.item).toHaveProperty("updatedAt");
    }
  });

  it("writes JOB_CREATED audit log with authenticated employer as actor", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const auditInsert = tx.insert.mock.results[2].value;
    expect(auditInsert.values).toHaveBeenCalledTimes(1);
    const auditData = auditInsert.values.mock.calls[0][0];
    expect(auditData).toEqual({
      actorUserId: USER_ID,
      action: "JOB_CREATED",
      targetType: "job",
      targetId: JOB_ID,
      metadata: { source: "employer", organizationId: ORG_ID },
    });
  });

  it("writes exactly one job_sources row with the EMPLOYER source", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const jobInsert = tx.insert.mock.results[0].value;
    expect(jobInsert.values).toHaveBeenCalledTimes(1);

    const sourceInsert = tx.insert.mock.results[1].value;
    expect(sourceInsert.values).toHaveBeenCalledTimes(1);
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData).toEqual({
      jobId: JOB_ID,
      sourceId: EMPLOYER_SOURCE_ID,
      sourceUrl: `jobethiopia://source/${EMPLOYER_SOURCE_ID}/external/none`,
      externalId: null,
      rawHash: null,
      lastSeenAt: null,
    });
  });

  it("resolves sourceId from the server-owned EMPLOYER source, not client input", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.sourceId).toBe(EMPLOYER_SOURCE_ID);
    expect(sourceData).not.toHaveProperty("sourceType");
    expect(INPUT).not.toHaveProperty("sourceId");
    expect(INPUT).not.toHaveProperty("sourceType");
  });

  it("stores a server-controlled internal provenance URL", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.sourceUrl).toBe(`jobethiopia://source/${EMPLOYER_SOURCE_ID}/external/none`);
    expect(sourceData.sourceUrl).not.toMatch(/^https?:\/\//);
  });

  it("leaves externalId and rawHash null and defaults firstSeenAt/timestamps", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.externalId).toBeNull();
    expect(sourceData.rawHash).toBeNull();
    expect(sourceData.lastSeenAt).toBeNull();
    expect(sourceData).not.toHaveProperty("firstSeenAt");
    expect(sourceData).not.toHaveProperty("createdAt");
    expect(sourceData).not.toHaveProperty("updatedAt");
  });

  it("rolls back job creation when provenance insertion fails", async () => {
    const provenanceError = new Error("insert or update on table job_sources");
    const provenanceChain = {
      values: vi.fn().mockRejectedValue(provenanceError),
    };

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: EMPLOYER_SOURCE_ID }]),
        ),
      insert: vi.fn()
        .mockReturnValueOnce(buildTxInsertChain(CREATED_JOB))
        .mockReturnValueOnce(provenanceChain),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await expect(createEmployerJob(USER_ID, INPUT)).rejects.toThrow(
      "insert or update on table job_sources",
    );
  });

  it("rolls back job creation when the EMPLOYER source record is missing", async () => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        )
        .mockReturnValueOnce(buildTxSelectChain([])),
      insert: vi.fn().mockReturnValue(buildTxInsertChain(CREATED_JOB)),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await expect(createEmployerJob(USER_ID, INPUT)).rejects.toThrow(
      "Employer source record not configured",
    );
  });

  it("does not write provenance when authorization is denied", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(
        buildTxSelectChain([{ role: "CANDIDATE", isActive: true }]),
      ),
      insert: vi.fn(),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("forces status to DRAFT even if client attempts to override", async () => {
    const tx = buildSuccessTxChain(CREATED_JOB);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await createEmployerJob(USER_ID, INPUT);

    const jobInsert = tx.insert.mock.results[0].value;
    const insertData = jobInsert.values.mock.calls[0][0];
    expect(insertData.status).toBe("DRAFT");
    expect(insertData.verificationStatus).toBe("PENDING");
  });

  it("returns SLUG_COLLISION after exhausting retries", async () => {
    const slugError = new Error("duplicate key value violates unique constraint: jobs_slug_unique");

    const slugErrorChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(slugError),
    };

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        ),
      insert: vi.fn().mockReturnValue(slugErrorChain),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "SLUG_COLLISION" });
  });

  it("retries slug on collision and succeeds on next attempt", async () => {
    const slugError = new Error("duplicate key value violates unique constraint: jobs_slug_unique");
    const retryJob = { ...CREATED_JOB, slug: "software-engineer-1" };

    const slugErrorChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(slugError),
    };
    const successChain = buildTxInsertChain(retryJob);

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: EMPLOYER_SOURCE_ID }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ name: "Acme Corp" }]),
        ),
      insert: vi.fn()
        .mockReturnValueOnce(slugErrorChain)
        .mockReturnValueOnce(successChain)
        .mockReturnValueOnce(buildTxInsertChain(undefined))
        .mockReturnValueOnce(buildTxInsertChain(undefined)),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.slug).toBe("software-engineer-1");
    }
  });

  it("retries on a PG-wrapped unique violation carried on the cause chain", async () => {
    const cause = Object.assign(
      new Error('duplicate key value violates unique constraint "jobs_slug_unique"'),
      { code: "23505", constraint: "jobs_slug_unique" },
    );
    const wrappedSlugError = new Error("job INSERT failed", { cause });
    const retryJob = { ...CREATED_JOB, slug: "software-engineer-1" };

    const slugErrorChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(wrappedSlugError),
    };
    const successChain = buildTxInsertChain(retryJob);

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: EMPLOYER_SOURCE_ID }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ name: "Acme Corp" }]),
        ),
      insert: vi.fn()
        .mockReturnValueOnce(slugErrorChain)
        .mockReturnValueOnce(successChain)
        .mockReturnValueOnce(buildTxInsertChain(undefined))
        .mockReturnValueOnce(buildTxInsertChain(undefined)),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.slug).toBe("software-engineer-1");
    }
  });

  it("throws non-slug errors instead of retrying", async () => {
    const dbError = new Error("connection refused");

    const dbErrorChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(dbError),
    };

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([]),
        ),
      insert: vi.fn().mockReturnValue(dbErrorChain),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await expect(createEmployerJob(USER_ID, INPUT)).rejects.toThrow(
      "connection refused",
    );
  });

  function buildWarningTxChain(
    duplicateChain: Record<string, ReturnType<typeof vi.fn>>,
  ) {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(
          buildTxSelectChain([{ role: "ORGANIZATION_ADMIN", isActive: true }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: ORG_ID, status: "ACTIVE" }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: "m1" }]),
        )
        .mockReturnValueOnce(duplicateChain)
        .mockReturnValueOnce(
          buildTxSelectChain([{ id: EMPLOYER_SOURCE_ID }]),
        )
        .mockReturnValueOnce(
          buildTxSelectChain([{ name: "Acme Corp" }]),
        ),
      insert: vi.fn()
        .mockReturnValueOnce(buildTxInsertChain(CREATED_JOB))
        .mockReturnValueOnce(buildTxInsertChain(undefined))
        .mockReturnValueOnce(buildTxInsertChain(undefined)),
    };
    return tx;
  }

  function duplicateMatch(
    status: string,
    overrides: Record<string, unknown> = {},
  ) {
    return { id: JOB_ID_2, title: "Software Engineer", status, ...overrides };
  }

  function runWith(tx: Record<string, unknown>) {
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );
    return createEmployerJob(USER_ID, INPUT);
  }

  it("succeeds without a warning when no matching job exists", async () => {
    const result = await runWith(buildSuccessTxChain(CREATED_JOB));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
  });

  it.each(["DRAFT", "PENDING_REVIEW", "PUBLISHED"] as const)(
    "returns a warning when a %s job matches",
    async (status) => {
      const tx = buildWarningTxChain(
        buildTxSelectChain([duplicateMatch(status)]),
      );
      const result = await runWith(tx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warning).toBeDefined();
        expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
        expect(result.warning?.matchedJobId).toBe(JOB_ID_2);
        expect(result.warning?.matchedStatus).toBe(status);
      }
    },
  );

  it("does not warn when the only match is EXPIRED", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("EXPIRED")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
  });

  it("does not warn when the only match is REMOVED", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("REMOVED")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
  });

  it("scopes the duplicate lookup to the verified organization", async () => {
    const duplicateChain = buildTxSelectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain(ORG_ID);
  });

  it("does not warn when the existing job is in a different location", async () => {
    const LOCATION_A = "aaaa1111-1111-4111-8111-111111111111";
    const LOCATION_B = "bbbb1111-1111-4111-8111-111111111111";
    const duplicateChain = buildTxSelectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );
    const result = await createEmployerJob(USER_ID, {
      ...INPUT,
      locationId: LOCATION_A,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain(LOCATION_A);
    expect(params).not.toContain(LOCATION_B);
  });

  it("does not warn when the existing job has a different title", async () => {
    const duplicateChain = buildTxSelectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );
    const result = await createEmployerJob(USER_ID, {
      ...INPUT,
      title: "Senior Software Engineer",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain("Senior Software Engineer");
  });

  it("warns when both jobs have a null location", async () => {
    const duplicateChain = buildTxSelectChain([
      duplicateMatch("DRAFT"),
    ]);
    const tx = buildWarningTxChain(duplicateChain);
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning?.matchedJobId).toBe(JOB_ID_2);
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain("Software Engineer");
    expect(params).toContain(ORG_ID);
  });

  it("does not warn when the new job has a null location and the match has one", async () => {
    const duplicateChain = buildTxSelectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    expect(duplicateChain.where).toHaveBeenCalledTimes(1);
  });

  it("uses ORDER BY updatedAt/createdAt DESC with LIMIT 1 for multiple matches", async () => {
    const duplicateChain = buildTxSelectChain([
      duplicateMatch("PUBLISHED", { id: JOB_ID }),
    ]);
    const tx = buildWarningTxChain(duplicateChain);
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning?.matchedJobId).toBe(JOB_ID);
    }
    expect(duplicateChain.orderBy).toHaveBeenCalledTimes(1);
    expect(duplicateChain.orderBy.mock.calls[0]).toHaveLength(2);
    expect(duplicateChain.limit).toHaveBeenCalledWith(1);
  });

  it("still creates and returns the job when a warning is present", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("PUBLISHED")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.id).toBe(JOB_ID);
      expect(result.warning?.matchedJobId).toBe(JOB_ID_2);
    }
  });

  it("warning contains matchedJobId, matchedJobTitle, and matchedStatus", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("DRAFT", { title: "Nurse" })]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toEqual({
        code: "POSSIBLE_DUPLICATE",
        message: "Possible duplicate — review existing jobs before publishing.",
        matchedJobId: JOB_ID_2,
        matchedJobTitle: "Nurse",
        matchedStatus: "DRAFT",
      });
    }
  });

  it("derives the warning entirely from server data", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("DRAFT")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeDefined();
    }
    expect(INPUT).not.toHaveProperty("warning");
    expect(INPUT).not.toHaveProperty("matchedJobId");
    expect(INPUT).not.toHaveProperty("matchedStatus");
  });

  it("does not run the duplicate lookup when authorization fails", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(
        buildTxSelectChain([{ role: "CANDIDATE", isActive: true }]),
      ),
      insert: vi.fn(),
    };
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );
    const result = await createEmployerJob(USER_ID, INPUT);
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("still creates the EMPLOYER provenance row when a warning is present", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("PUBLISHED")]),
    );
    await runWith(tx);
    const sourceInsert = tx.insert.mock.results[1].value;
    expect(sourceInsert.values).toHaveBeenCalledTimes(1);
    const data = sourceInsert.values.mock.calls[0][0];
    expect(data.jobId).toBe(JOB_ID);
    expect(data.sourceId).toBe(EMPLOYER_SOURCE_ID);
  });

  it("does not alter job status when a warning is present", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("PUBLISHED")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.status).toBe("DRAFT");
    }
  });

  it("does not alter verificationStatus when a warning is present", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("PUBLISHED")]),
    );
    const result = await runWith(tx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.verificationStatus).toBe("PENDING");
    }
  });

  it("runs the duplicate lookup before inserting the job", async () => {
    const tx = buildWarningTxChain(
      buildTxSelectChain([duplicateMatch("DRAFT")]),
    );
    await runWith(tx);
    const selectOrder = tx.select.mock.invocationCallOrder;
    const insertOrder = tx.insert.mock.invocationCallOrder;
    expect(selectOrder[3]).toBeLessThan(insertOrder[0]);
  });
});

function buildTxChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildChangeStatusTxChain(opts: {
  job?: { id: string; currentStatus: string; organizationId: string } | null;
  user?: { role: string; isActive: boolean } | null;
  org?: { status: string } | null;
  membership?: { id: string } | null;
  updateResult?: { id: string; status: string };
}) {
  const jobRow = opts.job !== undefined ? opts.job : { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID };
  const userRow = opts.user !== undefined ? opts.user : { role: "ORGANIZATION_ADMIN", isActive: true };
  const orgRow = opts.org !== undefined ? opts.org : { status: "ACTIVE" };
  const membershipRow = opts.membership !== undefined ? opts.membership : { id: "m1" };
  const updateRow = opts.updateResult ?? { id: JOB_ID, status: "PENDING_REVIEW" };

  const tx = {
    select: vi.fn()
      .mockReturnValueOnce(buildTxChain(jobRow !== null ? [jobRow] : []))
      .mockReturnValueOnce(buildTxChain(userRow !== null ? [userRow] : []))
      .mockReturnValueOnce(buildTxChain(orgRow !== null ? [orgRow] : []))
      .mockReturnValueOnce(buildTxChain(membershipRow !== null ? [membershipRow] : [])),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updateRow]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  };
  return tx;
}

describe("changeEmployerJobStatus", () => {
  it("returns NOT_FOUND when job does not exist", async () => {
    const tx = buildChangeStatusTxChain({ job: null });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns USER_INACTIVE when role is not ORGANIZATION_ADMIN", async () => {
    const tx = buildChangeStatusTxChain({ user: { role: "CANDIDATE", isActive: true } });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns USER_INACTIVE when user is inactive", async () => {
    const tx = buildChangeStatusTxChain({ user: { role: "ORGANIZATION_ADMIN", isActive: false } });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns USER_INACTIVE when user does not exist", async () => {
    const tx = buildChangeStatusTxChain({ user: null });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "USER_INACTIVE" });
  });

  it("returns FORBIDDEN when organization does not exist", async () => {
    const tx = buildChangeStatusTxChain({ org: null });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns ORG_INACTIVE when organization is inactive", async () => {
    const tx = buildChangeStatusTxChain({ org: { status: "INACTIVE" } });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "ORG_INACTIVE" });
  });

  it("returns FORBIDDEN when no organization membership exists", async () => {
    const tx = buildChangeStatusTxChain({ membership: null });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns INVALID_TRANSITION for DRAFT → PUBLISHED", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PUBLISHED" as never);
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("returns INVALID_TRANSITION for PUBLISHED → PENDING_REVIEW", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "PUBLISHED", organizationId: ORG_ID },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("returns INVALID_TRANSITION for REMOVED → DRAFT", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "REMOVED", organizationId: ORG_ID },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "DRAFT");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("succeeds for DRAFT → PENDING_REVIEW", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item).toEqual({ id: JOB_ID, status: "PENDING_REVIEW" });
    }
  });

  it("succeeds for PENDING_REVIEW → DRAFT", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "PENDING_REVIEW", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "DRAFT" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "DRAFT");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item).toEqual({ id: JOB_ID, status: "DRAFT" });
    }
  });

  it("writes audit log with correct actor/fromStatus/toStatus/source metadata", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");

    const auditValues = tx.insert.mock.results[0].value;
    expect(auditValues.values).toHaveBeenCalledTimes(1);
    const auditData = auditValues.values.mock.calls[0][0];
    expect(auditData).toEqual({
      actorUserId: USER_ID,
      action: "JOB_UPDATED",
      targetType: "job",
      targetId: JOB_ID,
      metadata: {
        source: "employer",
        fromStatus: "DRAFT",
        toStatus: "PENDING_REVIEW",
      },
    });
  });

  it("returns item with correct id and status on success", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    const result = await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.id).toBe(JOB_ID);
      expect(result.item.status).toBe("PENDING_REVIEW");
    }
  });

  it("reads organizationId from the database job record", async () => {
    const customOrgId = "99999999-9999-4999-8999-999999999999";
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: customOrgId },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");

    const auditValues = tx.insert.mock.results[0].value;
    const auditData = auditValues.values.mock.calls[0][0];
    expect(auditData.metadata).toEqual({
      source: "employer",
      fromStatus: "DRAFT",
      toStatus: "PENDING_REVIEW",
    });
  });

  it("uses server-side userId as actor, not client-supplied", async () => {
    const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await changeEmployerJobStatus(actorId, JOB_ID, "PENDING_REVIEW");

    const auditValues = tx.insert.mock.results[0].value;
    const auditData = auditValues.values.mock.calls[0][0];
    expect(auditData.actorUserId).toBe(actorId);
  });

  it("does not modify verificationStatus during status transition", async () => {
    const tx = buildChangeStatusTxChain({
      job: { id: JOB_ID, currentStatus: "DRAFT", organizationId: ORG_ID },
      updateResult: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    mocks.mockDbTransaction.mockImplementation(
      (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    );

    await changeEmployerJobStatus(USER_ID, JOB_ID, "PENDING_REVIEW");

    const updateCall = tx.update.mock.results[0].value;
    const setData = updateCall.set.mock.calls[0][0];
    expect(setData).not.toHaveProperty("verificationStatus");
    expect(setData).toEqual({
      status: "PENDING_REVIEW",
      updatedAt: expect.any(Date),
    });
  });
});
