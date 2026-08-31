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
  listEmployerTeam,
  getEmployerTeamOrganizations,
  addEmployerTeamMember,
  removeEmployerTeamMember,
  resolveEmployerTeamMembership,
} from "../team";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "33333333-3333-4333-8333-333333333333";
const MEMBER_A = "44444444-4444-4444-8444-444444444444";
const MEMBER_B = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP_1 = "66666666-6666-4666-8666-666666666666";
const MEMBERSHIP_2 = "77777777-7777-4777-8777-777777777777";

const ORG_ADMIN = "ORGANIZATION_ADMIN";

function buildSelectChain(
  result: unknown[],
  terminal: ("limit" | "orderBy" | "offset" | "groupBy" | "where")[] = [
    "limit",
    "orderBy",
    "offset",
    "groupBy",
  ],
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy = terminal.includes("groupBy")
    ? vi.fn().mockResolvedValue(result)
    : vi.fn().mockReturnValue(chain);
  chain.orderBy = terminal.includes("orderBy")
    ? vi.fn().mockResolvedValue(result)
    : vi.fn().mockReturnValue(chain);
  chain.limit = terminal.includes("limit")
    ? vi.fn().mockResolvedValue(result)
    : vi.fn().mockReturnValue(chain);
  chain.offset = terminal.includes("offset")
    ? vi.fn().mockResolvedValue(result)
    : vi.fn().mockReturnValue(chain);
  chain.where = terminal.includes("where")
    ? vi.fn().mockResolvedValue(result)
    : vi.fn().mockReturnValue(chain);
  return chain;
}

type Tx = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeTx(): Tx {
  return { select: vi.fn(), insert: vi.fn(), delete: vi.fn() };
}

function mockTxSequence(tx: Tx, chains: ReturnType<typeof buildSelectChain>[]) {
  tx.select.mockReset();
  for (const c of chains) tx.select.mockImplementationOnce(() => c);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listEmployerTeam", () => {
  it("returns empty when actor has no org memberships", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await listEmployerTeam(ACTOR);
    expect(result).toEqual([]);
  });

  it("lists members for own organization only", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_A]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        {
          membershipId: MEMBERSHIP_1,
          organizationId: ORG_A,
          organizationName: "Acme",
          userId: MEMBER_A,
          name: "Jane",
          email: "jane@acme.com",
          role: ORG_ADMIN,
          isActive: true,
          joinedAt: new Date(),
        },
      ]),
    );
    const result = await listEmployerTeam(ACTOR);
    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe(ORG_A);
    expect(result[0]).not.toHaveProperty("passwordHash");
    expect(result[0]).not.toHaveProperty("candidatePhone");
  });

  it("aggregates across multiple organizations", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_A, ORG_B]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        { membershipId: MEMBERSHIP_1, organizationId: ORG_A, organizationName: "Acme", userId: MEMBER_A, name: "Jane", email: "j@a", role: ORG_ADMIN, isActive: true, joinedAt: new Date() },
        { membershipId: MEMBERSHIP_2, organizationId: ORG_B, organizationName: "Beta", userId: MEMBER_B, name: "Bob", email: "b@b", role: ORG_ADMIN, isActive: true, joinedAt: new Date() },
      ]),
    );
    const result = await listEmployerTeam(ACTOR);
    expect(result.map((m) => m.organizationId)).toEqual([ORG_A, ORG_B]);
  });

  it("marks inactive members but keeps them visible", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_A]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([
        { membershipId: MEMBERSHIP_1, organizationId: ORG_A, organizationName: "Acme", userId: MEMBER_A, name: "Jane", email: "j@a", role: ORG_ADMIN, isActive: false, joinedAt: new Date() },
      ]),
    );
    const result = await listEmployerTeam(ACTOR);
    expect(result[0].isActive).toBe(false);
  });
});

describe("getEmployerTeamOrganizations", () => {
  it("returns only ACTIVE orgs the actor belongs to", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([ORG_A]);
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([{ id: ORG_A, name: "Acme" }]),
    );
    const result = await getEmployerTeamOrganizations(ACTOR);
    expect(result).toEqual([{ id: ORG_A, name: "Acme" }]);
  });

  it("returns empty when actor belongs to no orgs", async () => {
    mocks.mockGetUserOrgIds.mockResolvedValue([]);
    const result = await getEmployerTeamOrganizations(ACTOR);
    expect(result).toEqual([]);
  });
});

describe("resolveEmployerTeamMembership", () => {
  it("resolves membership to org and target from DB", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(
      buildSelectChain([{ organizationId: ORG_A, targetUserId: MEMBER_A }]),
    );
    const result = await resolveEmployerTeamMembership(MEMBERSHIP_1);
    expect(result).toEqual({ organizationId: ORG_A, targetUserId: MEMBER_A });
  });

  it("returns null when membership not found", async () => {
    mocks.mockDbSelectChain.mockReturnValueOnce(buildSelectChain([]));
    const result = await resolveEmployerTeamMembership(MEMBERSHIP_1);
    expect(result).toBeNull();
  });
});

describe("addEmployerTeamMember", () => {
  it("valid add succeeds with safe item and audit", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([
        { id: MEMBER_A, name: "Jane", email: "jane@acme.com", role: ORG_ADMIN, isActive: true },
      ]),
    ]);
    const created = {
      id: MEMBERSHIP_2,
      organizationId: ORG_A,
      userId: MEMBER_A,
      createdAt: new Date(),
    };
    tx.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) });
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );

    const result = await addEmployerTeamMember(ACTOR, ORG_A, "jane@acme.com");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.organizationId).toBe(ORG_A);
      expect(result.item.userId).toBe(MEMBER_A);
      expect(result.item).not.toHaveProperty("passwordHash");
    }
    // two inserts: membership + audit
    expect(tx.insert).toHaveBeenCalledTimes(2);
    // audit metadata must be PII-light
    const auditValuesPayload = tx.insert.mock.results[1].value.values.mock.calls[0][0];
    expect(auditValuesPayload).toMatchObject({
      action: "ORGANIZATION_MEMBER_ADDED",
      targetType: "organization_member",
    });
    expect(JSON.stringify(auditValuesPayload)).toEqual(
      expect.not.stringMatching(/email|name|password/i),
    );
  });

  it("rejects actor without org membership", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "jane@acme.com");
    expect(result).toMatchObject({ ok: false, code: "ACTOR_NOT_AUTHORIZED" });
  });

  it("rejects nonexistent target", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "nobody@x.com");
    expect(result).toMatchObject({ ok: false, code: "TARGET_USER_NOT_FOUND" });
  });

  it("rejects inactive target", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([{ id: MEMBER_A, name: "Jane", email: "j@a", role: ORG_ADMIN, isActive: false }]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "j@a");
    expect(result).toMatchObject({ ok: false, code: "TARGET_USER_INACTIVE" });
  });

  it("rejects target with wrong role", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([{ id: MEMBER_A, name: "Jane", email: "j@a", role: "CANDIDATE", isActive: true }]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "j@a");
    expect(result).toMatchObject({
      ok: false,
      code: "TARGET_NOT_ORGANIZATION_ADMIN",
    });
  });

  it("handles duplicate add safely as ALREADY_MEMBER", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([{ id: MEMBER_A, name: "Jane", email: "j@a", role: ORG_ADMIN, isActive: true }]),
    ]);
    const dupError = new Error('duplicate key value violates unique constraint "organization_members_org_user_unique"');
    tx.insert
      .mockReturnValueOnce({
        values: vi.fn().mockImplementation(() => {
          throw dupError;
        }),
      });
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "j@a");
    expect(result).toMatchObject({ ok: false, code: "ALREADY_MEMBER" });
  });

  it("rejects inactive actor", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [buildSelectChain([{ role: ORG_ADMIN, isActive: false }])]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "j@a");
    expect(result).toMatchObject({ ok: false, code: "ACTOR_NOT_AUTHORIZED" });
  });

  it("rejects inactive organization", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "INACTIVE" }]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await addEmployerTeamMember(ACTOR, ORG_A, "j@a");
    expect(result).toMatchObject({ ok: false, code: "ORGANIZATION_INACTIVE" });
  });
});

describe("removeEmployerTeamMember", () => {
  function baseChains(countValue: number) {
    return [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]), // actor
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]), // org
      buildSelectChain([{ id: MEMBERSHIP_1 }]), // actor membership
      buildSelectChain([{ id: MEMBERSHIP_2, userId: MEMBER_A }]), // target membership
      buildSelectChain([{ id: MEMBER_A, role: ORG_ADMIN, isActive: true }]), // target user
      buildSelectChain([{ count: countValue }], ["where"]), // admin count (terminal where)
    ];
  }

  function mockDeleteOk(tx: Tx) {
    tx.delete.mockReturnValueOnce({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    });
    tx.insert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue([]) });
  }

  it("remove succeeds and audits", async () => {
    const tx = makeTx();
    mockTxSequence(tx, baseChains(2));
    mockDeleteOk(tx);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, MEMBER_A);
    expect(result).toMatchObject({ ok: true, removed: true });
    expect(tx.delete).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects when target membership is missing", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([]),
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, MEMBER_A);
    expect(result).toMatchObject({ ok: false, code: "MEMBERSHIP_NOT_FOUND" });
  });

  it("rejects last active admin removal", async () => {
    const tx = makeTx();
    mockTxSequence(tx, baseChains(1));
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, MEMBER_A);
    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
  });

  it("allows self-removal when another active admin remains", async () => {
    const tx = makeTx();
    mockTxSequence(tx, baseChains(2));
    mockDeleteOk(tx);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, ACTOR);
    expect(result).toMatchObject({ ok: true });
  });

  it("blocks self-removal when last admin", async () => {
    const tx = makeTx();
    mockTxSequence(tx, baseChains(1));
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, ACTOR);
    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
  });

  it("allows removing an inactive admin without blocking active admin removal", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_A, name: "Acme", status: "ACTIVE" }]),
      buildSelectChain([{ id: MEMBERSHIP_1 }]),
      buildSelectChain([{ id: MEMBERSHIP_2, userId: MEMBER_A }]),
      buildSelectChain([{ id: MEMBER_A, role: ORG_ADMIN, isActive: false }]), // inactive target
      buildSelectChain([{ count: 1 }], ["where"]), // one active admin
    ]);
    mockDeleteOk(tx);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_A, MEMBER_A);
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects cross-org removal when actor not member", async () => {
    const tx = makeTx();
    mockTxSequence(tx, [
      buildSelectChain([{ role: ORG_ADMIN, isActive: true }]),
      buildSelectChain([{ id: ORG_B, name: "Beta", status: "ACTIVE" }]),
      buildSelectChain([]), // actor membership missing in ORG_B
    ]);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    const result = await removeEmployerTeamMember(ACTOR, ORG_B, MEMBER_B);
    expect(result).toMatchObject({ ok: false, code: "ACTOR_NOT_AUTHORIZED" });
  });

  it("audit metadata is PII-light (no email/name)", async () => {
    const tx = makeTx();
    mockTxSequence(tx, baseChains(2));
    mockDeleteOk(tx);
    mocks.mockDbTransaction.mockImplementation(
      async (fn: (t: Tx) => Promise<unknown>) => fn(tx),
    );
    await removeEmployerTeamMember(ACTOR, ORG_A, MEMBER_A);
    const auditValuesPayload = tx.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(auditValuesPayload).toMatchObject({
      action: "ORGANIZATION_MEMBER_REMOVED",
      targetType: "organization_member",
      metadata: { organizationId: ORG_A, targetUserId: MEMBER_A },
    });
    expect(JSON.stringify(auditValuesPayload)).toEqual(
      expect.not.stringMatching(/email|name|password/i),
    );
  });
});
