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
