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
  changeEmployerApplicationStatuses,
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
  chain.leftJoin = vi.fn().mockReturnValue(chain);
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
    // employer list does not carry candidate profile payload
    expect(result.items[0]).not.toHaveProperty("candidatePhone");
    expect(result.items[0]).not.toHaveProperty("candidateProfessionalSummary");
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

  it("returns profile fields for the candidate on the scoped application", async () => {
    const row = {
      id: APP_ID,
      jobId: JOB_ID,
      jobTitle: "Engineer",
      organizationName: "Acme",
      candidateName: "Jane",
      candidateEmail: "jane@example.com",
      coverLetter: "Hello",
      status: "SUBMITTED",
      createdAt: new Date(),
      updatedAt: new Date(),
      candidatePhone: "+251911234567",
      candidateLocationName: "Addis Ababa",
      candidateProfessionalSummary: "Engineer",
      candidateTotalExperienceYears: 5,
      candidateEducation: "BSc",
    };

    const chain = buildTerminalSelectChain([row]);
    mocks.mockDbSelectChain.mockReturnValueOnce(chain);

    const result = await getEmployerApplication(USER_ID, APP_ID);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.candidatePhone).toBe("+251911234567");
      expect(result.candidateLocationName).toBe("Addis Ababa");
      expect(result.candidateProfessionalSummary).toBe("Engineer");
      expect(result.candidateTotalExperienceYears).toBe(5);
      expect(result.candidateEducation).toBe("BSc");
    }
    // must left-join the candidate profile and its location
    expect(chain.leftJoin).toHaveBeenCalledTimes(2);
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
describe("changeEmployerApplicationStatuses", () => {
  const APP_A = "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const APP_B = "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
  const ACTIVE = "ACTIVE";

  function bulkTx({
    actor = [{ role: "ORGANIZATION_ADMIN", active: true }],
    apps = [],
    member = [{ id: "mem-1" }],
    updated = [],
  }: {
    actor?: { role: string; active: boolean }[];
    apps?: {
      applicationId: string;
      currentStatus: string;
      organizationId: string;
      orgStatus: string;
    }[];
    member?: { id: string }[];
    updated?: { id: string; status: string }[];
  }) {
    const tx: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(actor),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(apps),
              }),
            }),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(member),
            }),
          }),
        })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(updated),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    return tx;
  }

  function run(
    tx: Record<string, ReturnType<typeof vi.fn>>,
    ids: string[] = [APP_A],
    status: "REVIEWING" | "SHORTLISTED" | "REJECTED" = "REVIEWING",
  ) {
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Record<string, unknown>) => Promise<unknown>) => fn(tx),
    );
    return changeEmployerApplicationStatuses(USER_ID, ids, status);
  }

  function row(
    id: string,
    currentStatus: string,
    orgId: string = ORG_ID,
    orgStatus: string = ACTIVE,
  ) {
    return {
      applicationId: id,
      currentStatus,
      organizationId: orgId,
      orgStatus,
    };
  }

  it("signals invalid when the ID list is empty", async () => {
    mocks.mockDbTransaction.mockRejectedValue(new Error("should not run"));
    const result = await changeEmployerApplicationStatuses(USER_ID, [], "REVIEWING");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rejects non-ORG_ADMIN actor", async () => {
    const tx = bulkTx({ actor: [{ role: "CANDIDATE", active: true }] });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects an inactive actor", async () => {
    const tx = bulkTx({ actor: [{ role: "ORGANIZATION_ADMIN", active: false }] });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns NOT_FOUND when an application is missing", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "SUBMITTED")] });
    const result = await run(tx, [APP_A, APP_B]);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("rejects a cross-org (single) batch", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED", OTHER_ORG)],
      member: [],
    });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects a mixed-org batch", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED", ORG_ID), row(APP_B, "SUBMITTED", OTHER_ORG)],
    });
    const result = await run(tx, [APP_A, APP_B], "SHORTLISTED");
    expect(result).toEqual({ ok: false, code: "MIXED_ORG" });
  });

  it("rejects an inactive organization", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "SUBMITTED", ORG_ID, "INACTIVE")] });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "ORG_INACTIVE" });
  });

  it("rejects an actor who is not a member", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "SUBMITTED")], member: [] });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects invalid REVIEWING -> REVIEWING transition", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "REVIEWING")] });
    const result = await run(tx, [APP_A], "REVIEWING");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rejects a terminal REJECTED application", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "REJECTED")] });
    const result = await run(tx, [APP_A], "REJECTED");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rejects a terminal WITHDRAWN application", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "WITHDRAWN")] });
    const result = await run(tx);
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rejects a terminal SHORTLISTED application", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "SHORTLISTED")] });
    const result = await run(tx, [APP_A], "REJECTED");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rolls back the whole batch when one item is invalid (no update, no audit)", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "REJECTED")],
    });
    const result = await run(tx, [APP_A, APP_B], "REJECTED");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("succeeds for all-SUBMITTED -> REVIEWING", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "SUBMITTED")],
      updated: [
        { id: APP_A, status: "REVIEWING" },
        { id: APP_B, status: "REVIEWING" },
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "REVIEWING");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
      expect(result.items.map((i) => i.status)).toEqual([
        "REVIEWING",
        "REVIEWING",
      ]);
    }
  });

  it("succeeds for all-SUBMITTED -> SHORTLISTED", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "SUBMITTED")],
      updated: [
        { id: APP_A, status: "SHORTLISTED" },
        { id: APP_B, status: "SHORTLISTED" },
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "SHORTLISTED");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(2);
  });

  it("succeeds for mixed SUBMITTED/REVIEWING -> SHORTLISTED", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "REVIEWING")],
      updated: [
        { id: APP_A, status: "SHORTLISTED" },
        { id: APP_B, status: "SHORTLISTED" },
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "SHORTLISTED");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(2);
  });

  it("succeeds for mixed SUBMITTED/REVIEWING -> REJECTED", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "REVIEWING")],
      updated: [
        { id: APP_A, status: "REJECTED" },
        { id: APP_B, status: "REJECTED" },
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "REJECTED");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(2);
  });

  it("writes one audit row per application with from/to status", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "REVIEWING")],
      updated: [
        { id: APP_A, status: "REJECTED" },
        { id: APP_B, status: "REJECTED" },
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "REJECTED");
    expect(result.ok).toBe(true);
    expect(tx.insert).toHaveBeenCalledTimes(2);
    type AuditValue = {
      actorUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      metadata: unknown;
    };
    const valuesMock = (tx.insert as unknown as { mock: { results: { value: { values: { mock: { calls: [AuditValue][] } } } }[] } }).mock
      .results[0].value.values;
    const metas = valuesMock.mock.calls.map((c) => c[0]);
    expect(metas.every((m) => m.action === "APPLICATION_STATUS_CHANGED")).toBe(true);
    expect(metas.every((m) => m.actorUserId === USER_ID)).toBe(true);
    expect(metas.every((m) => m.targetType === "application")).toBe(true);
    const byId = Object.fromEntries(metas.map((m) => [m.targetId, m.metadata]));
    expect(byId[APP_A]).toEqual({ fromStatus: "SUBMITTED", toStatus: "REJECTED" });
    expect(byId[APP_B]).toEqual({ fromStatus: "REVIEWING", toStatus: "REJECTED" });
  });

  it("does not leak candidate PII into audit metadata", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED")],
      updated: [{ id: APP_A, status: "SHORTLISTED" }],
    });
    const result = await run(tx, [APP_A], "SHORTLISTED");
    expect(result.ok).toBe(true);
    type AuditValue = { metadata: unknown };
    const valuesMock = (tx.insert as unknown as { mock: { results: { value: { values: { mock: { calls: [AuditValue][] } } } }[] } }).mock
      .results[0].value.values;
    const meta = JSON.stringify(valuesMock.mock.calls[0][0]);
    expect(meta).not.toContain("email");
    expect(meta).not.toContain("candidate");
    expect(meta).not.toContain("Abebe");
  });

  it("surfaces INVALID_TRANSITION when the conditional update count mismatches (concurrent stale state)", async () => {
    const tx = bulkTx({
      apps: [row(APP_A, "SUBMITTED"), row(APP_B, "SUBMITTED")],
      updated: [{ id: APP_A, status: "REVIEWING" }],
    });
    const result = await run(tx, [APP_A, APP_B], "REVIEWING");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_TRANSITION");
  });

  it("rejects a batch already at the target status (idempotency via transition validation)", async () => {
    const tx = bulkTx({ apps: [row(APP_A, "REVIEWING")] });
    const result = await run(tx, [APP_A], "REVIEWING");
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("a multi-org actor is still limited to a single batch org", async () => {
    const tx = bulkTx({
      apps: [
        row(APP_A, "SUBMITTED", OTHER_ORG),
        row(APP_B, "SUBMITTED", ORG_ID),
      ],
    });
    const result = await run(tx, [APP_A, APP_B], "SHORTLISTED");
    expect(result).toEqual({ ok: false, code: "MIXED_ORG" });
  });
});
