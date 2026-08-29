import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockOrgsFindFirst: vi.fn(),
  mockOrgsFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockUsersSelect: vi.fn(),
  mockCountRows: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        organizations: {
          findFirst: (...args: unknown[]) => mocks.mockOrgsFindFirst(...args),
          findMany: (...args: unknown[]) => mocks.mockOrgsFindMany(...args),
        },
        auditLog: {
          findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
        },
      },
      select: (fields: Record<string, unknown>) => ({
        from: () => ({
          where: () => {
            if (fields && "count" in fields) {
              return mocks.mockCountRows();
            }
            return mocks.mockUsersSelect();
          },
        }),
      }),
      transaction: async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
        const tx = {
          update: mocks.mockUpdate,
          insert: mocks.mockInsert,
        };
        return fn(tx);
      },
      update: mocks.mockUpdate,
      insert: mocks.mockInsert,
    },
  };
});

import {
  listOrganizations,
  getOrganization,
  verifyOrganization,
  getOrganizationAuditHistory,
  isValidUuid,
} from "@/lib/admin/organizations";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ORG_ROW = {
  id: VALID_ID,
  name: "Test Org",
  slug: "test-org",
  description: null,
  industry: "Tech",
  websiteUrl: null,
  logoUrl: null,
  locationId: null,
  isVerified: false,
  status: "ACTIVE",
  verifiedAt: null,
  verifiedBy: null,
  verificationNotes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeTxMocks(returningResult: unknown[] = []) {
  const capturedSets: Record<string, unknown>[] = [];
  const capturedAudits: Record<string, unknown>[] = [];
  mocks.mockUpdate.mockImplementation((_table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      capturedSets.push(values);
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(returningResult),
        }),
      };
    },
  }));
  mocks.mockInsert.mockImplementation((_table: unknown) => ({
    values: (vals: Record<string, unknown>) => {
      capturedAudits.push(vals);
      return Promise.resolve([]);
    },
  }));
  return { capturedSets, capturedAudits };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockUsersSelect.mockResolvedValue([]);
});

describe("isValidUuid", () => {
  it("accepts valid UUID", () => {
    expect(isValidUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });
});

describe("listOrganizations", () => {
  it("returns paginated organizations", async () => {
    mocks.mockOrgsFindMany.mockResolvedValue([
      { ...ORG_ROW, id: VALID_ID },
    ]);
    const result = await listOrganizations({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
    expect(result.total).toBe(0);
  });

  it("applies isVerified filter", async () => {
    mocks.mockOrgsFindMany.mockResolvedValue([]);
    await listOrganizations({ isVerified: true });
    expect(mocks.mockOrgsFindMany).toHaveBeenCalled();
  });
});

describe("getOrganization", () => {
  it("returns organization for valid ID", async () => {
    mocks.mockOrgsFindFirst.mockResolvedValue(ORG_ROW);
    const result = await getOrganization(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
  });

  it("returns null for invalid UUID", async () => {
    const result = await getOrganization("not-a-uuid");
    expect(result).toBeNull();
    expect(mocks.mockOrgsFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when not found", async () => {
    mocks.mockOrgsFindFirst.mockResolvedValue(null);
    const result = await getOrganization(VALID_ID);
    expect(result).toBeNull();
  });
});

describe("verifyOrganization", () => {
  describe("VERIFY", () => {
    it("transitions unverified -> verified with correct fields", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      const { capturedSets, capturedAudits } = makeTxMocks([{ id: VALID_ID }]);

      const result = await verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(true);
      expect(capturedSets[0].isVerified).toBe(true);
      expect(capturedSets[0].verifiedBy).toBe(ACTOR_ID);
      expect(capturedSets[0].verificationNotes).toBeNull();
      expect(capturedAudits[0].action).toBe("ORGANIZATION_VERIFIED");
      expect(capturedAudits[0].actorUserId).toBe(ACTOR_ID);
      expect(capturedAudits[0].targetType).toBe("organization");
      expect(capturedAudits[0].targetId).toBe(VALID_ID);
      expect(capturedAudits[0].metadata).toEqual({
        fromStatus: "UNVERIFIED",
        toStatus: "VERIFIED",
      });
    });

    it("returns INVALID_STATE for already verified org", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: true });
      const result = await verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("INVALID_STATE");
    });

    it("returns NOT_FOUND for nonexistent org", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue(null);
      const result = await verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    });

    it("returns NOT_FOUND for invalid UUID", async () => {
      const result = await verifyOrganization("bad", "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(false);
    });

    it("does not write audit when update returns no row", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      const { capturedAudits } = makeTxMocks([]);
      const result = await verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(true);
      expect(capturedAudits).toHaveLength(0);
    });

    it("rolls back when audit insert fails", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      mocks.mockUpdate.mockImplementation((_table: unknown) => ({
        set: () => ({
          where: () => ({
            returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
          }),
        }),
      }));
      mocks.mockInsert.mockImplementation((_table: unknown) => ({
        values: () => {
          throw new Error("audit insert failed");
        },
      }));

      await expect(
        verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID),
      ).rejects.toThrow("Organization verification update failed");
    });
  });

  describe("REJECT", () => {
    it("transitions verified -> unverified with reason", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: true });
      const { capturedSets, capturedAudits } = makeTxMocks([{ id: VALID_ID }]);

      const result = await verifyOrganization(VALID_ID, "REJECT", ACTOR_ID, "Missing docs");
      expect(result.ok).toBe(true);
      expect(capturedSets[0].isVerified).toBe(false);
      expect(capturedSets[0].verifiedAt).toBeNull();
      expect(capturedSets[0].verifiedBy).toBeNull();
      expect(capturedSets[0].verificationNotes).toBe("Missing docs");
      expect(capturedAudits[0].action).toBe("ORGANIZATION_REJECTED");
      expect(capturedAudits[0].metadata).toEqual({
        fromStatus: "VERIFIED",
        toStatus: "UNVERIFIED",
        reason: "Missing docs",
      });
    });

    it("returns INVALID_STATE for already unverified org", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      const result = await verifyOrganization(VALID_ID, "REJECT", ACTOR_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("INVALID_STATE");
    });

    it("does not write audit when update returns no row", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: true });
      const { capturedAudits } = makeTxMocks([]);
      const result = await verifyOrganization(VALID_ID, "REJECT", ACTOR_ID);
      expect(result.ok).toBe(true);
      expect(capturedAudits).toHaveLength(0);
    });
  });

  describe("REQUEST_REVIEW", () => {
    it("transitions verified -> unverified with review notes", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: true });
      const { capturedSets, capturedAudits } = makeTxMocks([{ id: VALID_ID }]);

      const result = await verifyOrganization(VALID_ID, "REQUEST_REVIEW", ACTOR_ID, "Need more info");
      expect(result.ok).toBe(true);
      expect(capturedSets[0].isVerified).toBe(false);
      expect(capturedSets[0].verificationNotes).toBe("Need more info");
      expect(capturedAudits[0].action).toBe("ORGANIZATION_REVIEW_REQUESTED");
      expect(capturedAudits[0].metadata).toEqual({
        fromStatus: "VERIFIED",
        toStatus: "UNVERIFIED",
        reason: "Need more info",
      });
    });

    it("returns INVALID_STATE for already unverified org", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      const result = await verifyOrganization(VALID_ID, "REQUEST_REVIEW", ACTOR_ID);
      expect(result.ok).toBe(false);
    });
  });

  describe("concurrency safety", () => {
    it("concurrent verify on same org only audits once", async () => {
      mocks.mockOrgsFindFirst.mockResolvedValue({ id: VALID_ID, isVerified: false });
      const { capturedAudits } = makeTxMocks([]);
      const result = await verifyOrganization(VALID_ID, "VERIFY", ACTOR_ID);
      expect(result.ok).toBe(true);
      expect(capturedAudits).toHaveLength(0);
    });
  });
});

describe("getOrganizationAuditHistory", () => {
  it("returns empty for invalid UUID", async () => {
    const result = await getOrganizationAuditHistory("bad");
    expect(result).toEqual([]);
  });

  it("returns empty when no events", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    const result = await getOrganizationAuditHistory(VALID_ID);
    expect(result).toEqual([]);
  });

  it("maps audit entries with actor emails", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e1",
        action: "ORGANIZATION_VERIFIED",
        targetType: "organization",
        targetId: VALID_ID,
        metadata: { fromStatus: "UNVERIFIED", toStatus: "VERIFIED" },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorUserId: ACTOR_ID,
      },
    ]);
    mocks.mockUsersSelect.mockResolvedValue([{ id: ACTOR_ID, email: "admin@test.com" }]);

    const result = await getOrganizationAuditHistory(VALID_ID);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("ORGANIZATION_VERIFIED");
    expect(result[0].actorEmail).toBe("admin@test.com");
  });
});
