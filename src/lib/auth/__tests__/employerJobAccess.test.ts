import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbSelectChain: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockDbSelectChain(...args),
  },
}));

import {
  assertEmployerJobAccess,
  assertEmployerOrganizationAccess,
} from "../employerJobAccess";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function buildSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("assertEmployerJobAccess", () => {
  it("allows access for valid ORGANIZATION_ADMIN with membership", async () => {
    const firstChain = buildSelectChain([
      {
        jobId: JOB_ID,
        organizationId: ORG_ID,
        orgStatus: "ACTIVE",
        userRole: "ORGANIZATION_ADMIN",
        userActive: true,
      },
    ]);
    const secondChain = buildSelectChain([{ id: "mem-1" }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(firstChain)
      .mockReturnValueOnce(secondChain);

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({
      ok: true,
      jobId: JOB_ID,
      organizationId: ORG_ID,
    });
  });

  it("returns NOT_FOUND when job does not exist", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(buildSelectChain([]));

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns FORBIDDEN for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          jobId: JOB_ID,
          organizationId: ORG_ID,
          orgStatus: "ACTIVE",
          userRole: "CANDIDATE",
          userActive: true,
        },
      ]),
    );

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN for inactive user", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          jobId: JOB_ID,
          organizationId: ORG_ID,
          orgStatus: "ACTIVE",
          userRole: "ORGANIZATION_ADMIN",
          userActive: false,
        },
      ]),
    );

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN for inactive organization", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          jobId: JOB_ID,
          organizationId: ORG_ID,
          orgStatus: "INACTIVE",
          userRole: "ORGANIZATION_ADMIN",
          userActive: true,
        },
      ]),
    );

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN when no membership exists", async () => {
    const firstChain = buildSelectChain([
      {
        jobId: JOB_ID,
        organizationId: ORG_ID,
        orgStatus: "ACTIVE",
        userRole: "ORGANIZATION_ADMIN",
        userActive: true,
      },
    ]);
    const secondChain = buildSelectChain([]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(firstChain)
      .mockReturnValueOnce(secondChain);

    const result = await assertEmployerJobAccess(USER_ID, JOB_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});

describe("assertEmployerOrganizationAccess", () => {
  it("allows access for valid ORGANIZATION_ADMIN with membership", async () => {
    const firstChain = buildSelectChain([
      {
        organizationId: ORG_ID,
        orgStatus: "ACTIVE",
        userRole: "ORGANIZATION_ADMIN",
        userActive: true,
      },
    ]);
    const secondChain = buildSelectChain([{ id: "mem-1" }]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(firstChain)
      .mockReturnValueOnce(secondChain);

    const result = await assertEmployerOrganizationAccess(USER_ID, ORG_ID);
    expect(result).toEqual({ ok: true, organizationId: ORG_ID });
  });

  it("returns NOT_FOUND when organization does not exist", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(buildSelectChain([]));

    const result = await assertEmployerOrganizationAccess(USER_ID, ORG_ID);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns FORBIDDEN for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          organizationId: ORG_ID,
          orgStatus: "ACTIVE",
          userRole: "CANDIDATE",
          userActive: true,
        },
      ]),
    );

    const result = await assertEmployerOrganizationAccess(USER_ID, ORG_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN when no membership exists", async () => {
    const firstChain = buildSelectChain([
      {
        organizationId: ORG_ID,
        orgStatus: "ACTIVE",
        userRole: "ORGANIZATION_ADMIN",
        userActive: true,
      },
    ]);
    const secondChain = buildSelectChain([]);

    mocks.mockDbSelectChain
      .mockReturnValueOnce(firstChain)
      .mockReturnValueOnce(secondChain);

    const result = await assertEmployerOrganizationAccess(USER_ID, ORG_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});
