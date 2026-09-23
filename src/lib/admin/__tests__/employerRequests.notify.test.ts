import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockNotifyApproved: vi.fn(),
  mockNotifyRejected: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/users", () => ({
  users: {
    id: "users_id",
    role: "users_role",
    isActive: "users_is_active",
    email: "users_email",
    name: "users_name",
  },
}));

vi.mock("@/db/schema/organizations", () => ({
  organizations: {
    id: "orgs_id",
    name: "orgs_name",
    slug: "orgs_slug",
    status: "orgs_status",
  },
}));

vi.mock("@/db/schema/organizationMembers", () => ({
  organizationMembers: {
    id: "members_id",
    organizationId: "members_organization_id",
    userId: "members_user_id",
    createdAt: "members_created_at",
  },
}));

vi.mock("@/db/schema/auditLog", () => ({ auditLog: {} }));

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
  },
}));

vi.mock("@/lib/notifications/events", () => ({
  notifyEmployerOnboardingApproved: (...args: unknown[]) =>
    mocks.mockNotifyApproved(...args),
  notifyEmployerOnboardingRejected: (...args: unknown[]) =>
    mocks.mockNotifyRejected(...args),
}));

import {
  approveEmployerOnboarding,
  rejectEmployerOnboarding,
} from "../employerRequests";

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";

const REQUEST_ROW = {
  id: REQUEST_ID,
  userId: USER_ID,
  organizationName: "Almaz Coffee PLC",
  organizationSlug: "almaz-coffee",
  industry: "Coffee",
  description: null,
  websiteUrl: null,
  contactPhone: null,
  locationId: null,
  status: "PENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
});

function buildSelect(result: unknown[]) {
  const resolved = Array.isArray(result) ? result : [result];
  const chain = {} as Record<string, ReturnType<typeof vi.fn>>;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation(function (
    this: unknown,
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve(resolved).then(onFulfilled, onRejected);
  });
  return chain;
}

function buildUpdate() {
  return vi.fn().mockImplementation((table: Record<string, unknown>) => {
    const isRequestUpdate = table.status === "eor_status";
    return {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          isRequestUpdate
            ? {
                returning: () => Promise.resolve([{ id: REQUEST_ID }]),
              }
            : Promise.resolve({}),
        ),
      }),
    };
  });
}

function buildInsert() {
  return vi.fn().mockImplementation((table: Record<string, unknown>) => {
    const isOrg = table.id === "orgs_id";
    return {
      values: vi.fn().mockReturnValue(
        isOrg
          ? { returning: () => Promise.resolve([{ id: ORG_ID }]) }
          : Promise.resolve({}),
      ),
    };
  });
}

function buildApproveTx() {
  return {
    query: {
      employerOnboardingRequests: {
        findFirst: vi.fn().mockResolvedValue(REQUEST_ROW),
      },
    },
    select: vi.fn().mockReturnValue(buildSelect([{ id: USER_ID, role: "CANDIDATE", isActive: true }])),
    update: buildUpdate(),
    insert: buildInsert(),
  };
}

function buildRejectTx() {
  return {
    query: {
      employerOnboardingRequests: {
        findFirst: vi.fn().mockResolvedValue({
          id: REQUEST_ID,
          userId: USER_ID,
          organizationName: "Almaz Coffee PLC",
        }),
      },
    },
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: () =>
            Promise.resolve([{ organizationSlug: "almaz-coffee" }]),
        }),
      }),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue(Promise.resolve({})),
    })),
  };
}

describe("employer onboarding approval notification wiring", () => {
  it("notifies the approved submitter with the organization name", async () => {
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildApproveTx()),
    );
    mocks.mockNotifyApproved.mockResolvedValue(undefined);

    const result = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: true, organizationId: ORG_ID });
    expect(mocks.mockNotifyApproved).toHaveBeenCalledTimes(1);
    expect(mocks.mockNotifyApproved).toHaveBeenCalledWith({
      userId: USER_ID,
      organizationName: "Almaz Coffee PLC",
    });
  });

  it("does not notify when approval is refused for a non-pending request", async () => {
    const tx = buildApproveTx();
    tx.query.employerOnboardingRequests.findFirst.mockResolvedValue({
      ...REQUEST_ROW,
      status: "REJECTED",
    });
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    const result = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(mocks.mockNotifyApproved).not.toHaveBeenCalled();
  });

  it("does not notify when approval finds no request", async () => {
    const tx = buildApproveTx();
    tx.query.employerOnboardingRequests.findFirst.mockResolvedValue(null);
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    const result = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockNotifyApproved).not.toHaveBeenCalled();
  });

  it("approval still succeeds even when notification creation throws", async () => {
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildApproveTx()),
    );
    mocks.mockNotifyApproved.mockRejectedValue(new Error("notif down"));

    const result = await approveEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: true, organizationId: ORG_ID });
  });
});

describe("employer onboarding rejection notification wiring", () => {
  it("notifies the rejected submitter with the organization name", async () => {
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildRejectTx()),
    );
    mocks.mockNotifyRejected.mockResolvedValue(undefined);

    const result = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID, "duplicate org");
    expect(result).toEqual({ ok: true });
    expect(mocks.mockNotifyRejected).toHaveBeenCalledTimes(1);
    expect(mocks.mockNotifyRejected).toHaveBeenCalledWith({
      userId: USER_ID,
      organizationName: "Almaz Coffee PLC",
    });
  });

  it("does not notify when rejection fails for a non-pending request", async () => {
    const tx = buildRejectTx();
    tx.query.employerOnboardingRequests.findFirst.mockResolvedValue({
      id: REQUEST_ID,
      userId: USER_ID,
      organizationName: "Almaz Coffee PLC",
    });
    tx.update = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: () => Promise.resolve([]) }),
      }),
    }));
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    );

    const result = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: false, code: "INVALID_STATE" });
    expect(mocks.mockNotifyRejected).not.toHaveBeenCalled();
  });

  it("rejection still succeeds even when notification creation throws", async () => {
    mocks.mockTransaction.mockImplementation(
      async (fn: (t: unknown) => Promise<unknown>) => fn(buildRejectTx()),
    );
    mocks.mockNotifyRejected.mockRejectedValue(new Error("notif down"));

    const result = await rejectEmployerOnboarding(ACTOR_ID, REQUEST_ID);
    expect(result).toEqual({ ok: true });
  });
});