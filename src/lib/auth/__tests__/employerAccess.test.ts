import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbQuery: vi.fn(),
  mockDbSelectChain: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: (...args: unknown[]) => mocks.mockDbQuery(...args),
    select: (...args: unknown[]) => mocks.mockDbSelectChain(...args),
  },
}));

import { assertEmployerApplicationAccess } from "../employerAccess";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "33333333-3333-4333-8333-333333333333";
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

describe("assertEmployerApplicationAccess", () => {
  it("allows access for valid ORGANIZATION_ADMIN with membership", async () => {
    const firstChain = buildSelectChain([
      {
        applicationId: APP_ID,
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

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({
      ok: true,
      applicationId: APP_ID,
      organizationId: ORG_ID,
    });
  });

  it("returns NOT_FOUND when application does not exist", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(buildSelectChain([]));

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns FORBIDDEN for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          applicationId: APP_ID,
          organizationId: ORG_ID,
          orgStatus: "ACTIVE",
          userRole: "CANDIDATE",
          userActive: true,
        },
      ]),
    );

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN for inactive user", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          applicationId: APP_ID,
          organizationId: ORG_ID,
          orgStatus: "ACTIVE",
          userRole: "ORGANIZATION_ADMIN",
          userActive: false,
        },
      ]),
    );

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN for inactive organization", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          applicationId: APP_ID,
          organizationId: ORG_ID,
          orgStatus: "INACTIVE",
          userRole: "ORGANIZATION_ADMIN",
          userActive: true,
        },
      ]),
    );

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns FORBIDDEN when no membership exists", async () => {
    const firstChain = buildSelectChain([
      {
        applicationId: APP_ID,
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

    const result = await assertEmployerApplicationAccess(USER_ID, APP_ID);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});
