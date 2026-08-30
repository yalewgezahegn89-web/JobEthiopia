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
  getUserOrganizationIds: (...args: unknown[]) => mocks.mockGetUserOrgIds(...args),
}));

import {
  listEmployerApplications,
  getEmployerApplication,
  changeEmployerApplicationStatus,
} from "../applications";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "33333333-3333-4333-8333-333333333333";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "44444444-4444-4444-8444-444444444444";

function buildSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildTerminalSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  chain.offset = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mockGetUserOrgIds.mockResolvedValue([ORG_ID]);
});

describe("listEmployerApplications", () => {
  it("returns empty when user has no org memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await listEmployerApplications(USER_ID);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns applications across memberships", async () => {
    const mockRow = {
      id: APP_ID,
      jobId: JOB_ID,
      jobTitle: "Engineer",
      organizationId: ORG_ID,
      organizationName: "Acme",
      candidateName: "Jane",
      candidateEmail: "jane@example.com",
      status: "SUBMITTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Count query: ends at .where(), need it to resolve
    const countChain: Record<string, ReturnType<typeof vi.fn>> = {};
    countChain.from = vi.fn().mockReturnValue(countChain);
    countChain.innerJoin = vi.fn().mockReturnValue(countChain);
    countChain.where = vi.fn().mockResolvedValue([{ count: 1 }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(buildSelectChain([mockRow]))
      .mockReturnValueOnce(countChain);

    const result = await listEmployerApplications(USER_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(APP_ID);
  });
});

describe("getEmployerApplication", () => {
  it("returns null when no memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await getEmployerApplication(USER_ID, APP_ID);
    expect(result).toBeNull();
  });

  it("returns null when application not found in user's orgs", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(buildTerminalSelectChain([]));
    const result = await getEmployerApplication(USER_ID, APP_ID);
    expect(result).toBeNull();
  });
});

describe("changeEmployerApplicationStatus", () => {
  it("validates transition in transaction", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    applicationId: APP_ID,
                    currentStatus: "SUBMITTED",
                    organizationId: ORG_ID,
                    orgStatus: "ACTIVE",
                    userRole: "ORGANIZATION_ADMIN",
                    userActive: true,
                  },
                ]),
              }),
            }),
          }),
        }),
      }),
    };

    const memberChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "mem-1" }]),
        }),
      }),
    };

    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(memberChain),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: APP_ID, status: "REVIEWING" },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(tx),
    );

    const result = await changeEmployerApplicationStatus(
      USER_ID,
      APP_ID,
      "REVIEWING",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.status).toBe("REVIEWING");
    }
  });
});
