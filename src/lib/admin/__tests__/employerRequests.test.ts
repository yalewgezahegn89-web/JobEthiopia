import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "users_id",
    email: "users_email",
    name: "users_name",
    passwordHash: "users_password_hash",
    role: "users_role",
    isActive: "users_is_active",
  },
}));

vi.mock("@/db/schema/organizations", () => ({
  organizations: { marker: "org" },
}));

vi.mock("@/db/schema/organizationMembers", () => ({
  organizationMembers: { marker: "member" },
}));

vi.mock("@/db/schema/auditLog", () => ({ auditLog: { marker: "audit" } }));

vi.mock("@/db/schema/employerOnboardingRequests", () => ({
  employerOnboardingRequests: {
    id: "eor_id",
    userId: "eor_user_id",
    organizationName: "eor_organization_name",
    organizationSlug: "eor_organization_slug",
    industry: "eor_industry",
    description: "eor_description",
    websiteUrl: "eor_website_url",
    contactPhone: "eor_contact_phone",
    locationId: "eor_location_id",
    status: "eor_status",
    reviewedBy: "eor_reviewed_by",
    reviewedAt: "eor_reviewed_at",
  },
}));

import {
  approveEmployerOnboarding,
  rejectEmployerOnboarding,
  isValidUuid,
} from "../employerRequests";

interface TxConfig {
  request?: Record<string, unknown> | null;
  userRows?: Record<string, unknown>[];
  claim?: Record<string, unknown>[];
  updateError?: boolean;
  insertOrgError?: boolean;
}

interface TxResult {
  orgInsert?: Record<string, unknown>;
  memberInsert?: Record<string, unknown>;
  setValues?: Record<string, unknown>;
  audits: Record<string, unknown>[];
}

function buildTx(cfg: TxConfig): { tx: Record<string, unknown>; writes: TxResult } {
  const writes: TxResult = { audits: [] };
  const tx: Record<string, unknown> = {
    query: {
      employerOnboardingRequests: {
        findFirst: vi.fn().mockResolvedValue(cfg.request ?? null),
      },
    },
    select: vi.fn().mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(cfg.userRows ?? []),
        }),
      }),
    }),
    insert: vi.fn().mockImplementation((table: Record<string, unknown>) => ({
      values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
        if (table.marker === "org") {
          if (cfg.insertOrgError) return { returning: () => Promise.reject(new Error("org insert failed")) };
          writes.orgInsert = values;
          return { returning: () => Promise.resolve([{ id: "org-id" }]) };
        }
        if (table.marker === "member") {
          writes.memberInsert = values;
          return Promise.resolve({});
        }
        writes.audits.push(values);
        return Promise.resolve({});
      }),
    })),
    update: vi.fn().mockImplementation((_table: string) => ({
      set: (values: Record<string, unknown>) => {
        writes.setValues = values;
        return {
          where: () => ({
            returning: () => {
              if (cfg.updateError) return Promise.reject(new Error("update failed"));
              return Promise.resolve(cfg.claim ?? []);
            },
          }),
        };
      },
    })),
  };
  return { tx, writes };
}

function runTransaction(cfg: TxConfig) {
  return async (fn: (t: Record<string, unknown>) => Promise<unknown>) =>
    fn(buildTx(cfg).tx);
}

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const SUBMITTER_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";

function pendingRequest(): Record<string, unknown> {
  return {
    id: REQUEST_ID,
    userId: SUBMITTER_ID,
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    industry: "Coffee",
    description: "A roastery",
    websiteUrl: "https://almaz.example.com",
    contactPhone: "+251911000000",
    locationId: "00000000-0000-4000-8000-000000000001",
    status: "PENDING",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveEmployerOnboarding", () => {
  it("activates an employer in one atomic transaction", async () => {
    const cfg: TxConfig = {
      request: pendingRequest(),
      userRows: [{ id: SUBMITTER_ID, role: "CANDIDATE", isActive: true }],
      claim: [{ id: REQUEST_ID }],
    };
    let writes: TxResult | undefined;
    mocks.mockTransaction.mockImplementation(async (fn) => {
      const { tx, writes: w } = buildTx(cfg);
      writes = w;
      return fn(tx);
    });

    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: true, organizationId: "org-id" });

    expect(writes!.orgInsert).toBeTruthy();
    expect(writes!.orgInsert!.name).toBe("Almaz Coffee PLC");
    expect(writes!.orgInsert!.slug).toBe("almaz-coffee");
    expect(writes!.orgInsert!.isVerified).toBe(false);
    expect(writes!.orgInsert!.status).toBe("ACTIVE");

    expect(writes!.memberInsert!.organizationId).toBe("org-id");
    expect(writes!.memberInsert!.userId).toBe(SUBMITTER_ID);

    expect(writes!.setValues!.role).toBe("ORGANIZATION_ADMIN");

    const actions = writes!.audits.map((a) => a.action);
    expect(actions).toContain("EMPLOYER_ONBOARDING_APPROVED");
    expect(actions).toContain("ORGANIZATION_CREATED");
    expect(actions).toContain("ORGANIZATION_MEMBER_ADDED");
    expect(actions).toContain("USER_ROLE_CHANGED");

    const serialized = JSON.stringify(writes!.audits);
    expect(serialized).not.toContain("almaz@example.com");
    expect(serialized).not.toContain("+251911000000");
  });

  it("returns NOT_FOUND when the request does not exist", async () => {
    mocks.mockTransaction.mockImplementation(runTransaction({ request: null }));
    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns INVALID_STATE when the request is not pending", async () => {
    mocks.mockTransaction.mockImplementation(
      runTransaction({ request: { ...pendingRequest(), status: "APPROVED" } }),
    );
    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("returns INVALID_STATE when the submitter is not an active candidate", async () => {
    mocks.mockTransaction.mockImplementation(
      runTransaction({
        request: pendingRequest(),
        userRows: [{ id: SUBMITTER_ID, role: "ORGANIZATION_ADMIN", isActive: true }],
      }),
    );
    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("returns INVALID_STATE when a concurrent transaction already claimed it", async () => {
    mocks.mockTransaction.mockImplementation(
      runTransaction({
        request: pendingRequest(),
        userRows: [{ id: SUBMITTER_ID, role: "CANDIDATE", isActive: true }],
        claim: [],
      }),
    );
    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("returns NOT_FOUND for invalid uuids without touching the db", async () => {
    const r = await approveEmployerOnboarding(ACTOR_ID, "not-a-uuid");
    expect(r).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("maps a rollback-triggering failure to ERROR", async () => {
    mocks.mockTransaction.mockImplementation(
      runTransaction({
        request: pendingRequest(),
        userRows: [{ id: SUBMITTER_ID, role: "CANDIDATE", isActive: true }],
        claim: [{ id: REQUEST_ID }],
        insertOrgError: true,
      }),
    );
    const r = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "ERROR" });
  });
});

describe("rejectEmployerOnboarding", () => {
  it("rejects a pending request and writes an audit, leaving the user unchanged", async () => {
    const cfg: TxConfig = {
      claim: [{ organizationSlug: "almaz-coffee" }],
    };
    let writes: TxResult | undefined;
    mocks.mockTransaction.mockImplementation(async (fn) => {
      const { tx, writes: w } = buildTx(cfg);
      writes = w;
      return fn(tx);
    });

    const r = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID, "Duplicate org");
    expect(r).toEqual({ ok: true });

    expect(writes!.setValues!.status).toBe("REJECTED");
    expect(writes!.setValues!.reviewedBy).toBe(ACTOR_ID);
    expect(writes!.setValues!.reviewNotes).toBe("Duplicate org");
    expect(writes!.orgInsert).toBeUndefined();
    expect(writes!.memberInsert).toBeUndefined();

    const audit = writes!.audits.find((a) => a.action === "EMPLOYER_ONBOARDING_REJECTED");
    expect(audit).toBeTruthy();
    expect(audit!.targetId).toBe(REQUEST_ID);
    expect(audit!.actorUserId).toBe(ACTOR_ID);
  });

  it("trims blank review notes to null", async () => {
    const cfg: TxConfig = { claim: [{ organizationSlug: "almaz-coffee" }] };
    let writes: TxResult | undefined;
    mocks.mockTransaction.mockImplementation(async (fn) => {
      const { tx, writes: w } = buildTx(cfg);
      writes = w;
      return fn(tx);
    });
    await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID, "   ");
    expect(writes!.setValues!.reviewNotes).toBeNull();
  });

  it("returns NOT_FOUND when the request does not exist", async () => {
    mocks.mockTransaction.mockImplementation(runTransaction({ request: null }));
    const r = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns INVALID_STATE when the request is no longer pending", async () => {
    mocks.mockTransaction.mockImplementation(
      runTransaction({ request: { ...pendingRequest(), status: "APPROVED" } }),
    );
    const r = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(r).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("returns NOT_FOUND for invalid uuids without touching the db", async () => {
    const r = await rejectEmployerOnboarding(ACTOR_ID, "bad");
    expect(r).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });
});

describe("isValidUuid", () => {
  it("accepts a well-formed uuid and rejects others", () => {
    expect(isValidUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isValidUuid("bad")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});
