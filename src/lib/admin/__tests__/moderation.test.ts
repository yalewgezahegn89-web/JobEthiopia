import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockJobsFindFirst: vi.fn(),
  mockJobsFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockUsersSelect: vi.fn(),
  mockCountRows: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockEntityFindMany: vi.fn(),
}));

const capturedTx = vi.hoisted(() => ({ fn: null as null | ((tx: Record<string, unknown>) => Promise<void>) }));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        jobs: {
          findFirst: (...args: unknown[]) => mocks.mockJobsFindFirst(...args),
          findMany: (...args: unknown[]) => mocks.mockJobsFindMany(...args),
        },
        auditLog: {
          findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
        },
        organizations: { findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a) },
        categories: { findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a) },
        professions: { findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a) },
        locations: { findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a) },
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
        capturedTx.fn = fn;
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
  listModerationJobs,
  getModerationJob,
  moderateJob,
  getJobAuditHistory,
  VALID_STATUS_TRANSITIONS,
} from "@/lib/admin/jobs";

const JOB = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test Job",
  slug: "test-job",
  status: "PENDING_REVIEW",
  verificationStatus: "PENDING",
  description: "desc",
  requirements: null,
  responsibilities: null,
  benefits: null,
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  postedAt: new Date("2026-01-01T00:00:00.000Z"),
  deadline: null,
  applicationUrl: null,
  lastVerifiedAt: null,
  organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  categoryId: null,
  professionId: null,
  locationId: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeTxMocks() {
  const capturedSets: Record<string, unknown>[] = [];
  const capturedAudits: Record<string, unknown>[] = [];
  mocks.mockUpdate.mockImplementation((_table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      capturedSets.push(values);
      return { where: () => Promise.resolve() };
    },
  }));
  mocks.mockInsert.mockImplementation((_table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      capturedAudits.push(values);
      return { returning: async () => [] };
    },
  }));
  return { capturedSets, capturedAudits };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedTx.fn = null;
  mocks.mockEntityFindMany.mockResolvedValue([]);
});

describe("VALID_STATUS_TRANSITIONS (Batch 51 authoritative)", () => {
  it("matches the existing job route lifecycle table", () => {
    expect(VALID_STATUS_TRANSITIONS).toEqual({
      DRAFT: ["PENDING_REVIEW", "PUBLISHED", "REMOVED"],
      PENDING_REVIEW: ["DRAFT", "PUBLISHED", "REMOVED"],
      PUBLISHED: ["EXPIRED", "REMOVED"],
      EXPIRED: ["REMOVED"],
      REMOVED: [],
    });
  });
});

describe("listModerationJobs", () => {
  it("filters to PENDING_REVIEW or NEEDS_REVIEW and returns summaries", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([JOB]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listModerationJobs({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(JOB.id);
    expect(result.items[0].title).toBe("Test Job");
    expect(result.total).toBe(1);
  });

  it("paginates with clamped limit", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 100 }]);
    const result = await listModerationJobs({ page: 3, limit: 5000 });
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(1);
  });

  it("returns an empty queue", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
    const result = await listModerationJobs({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("propagates a DB error to the caller (generic handling upstream)", async () => {
    mocks.mockJobsFindMany.mockRejectedValue(new Error("db down"));
    await expect(listModerationJobs({ page: 1, limit: 20 })).rejects.toThrow();
  });
});

describe("getModerationJob", () => {
  it("returns the job for a valid UUID", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const job = await getModerationJob(JOB.id);
    expect(job?.id).toBe(JOB.id);
  });

  it("returns null for an invalid UUID", async () => {
    const job = await getModerationJob("not-a-uuid");
    expect(job).toBeNull();
    expect(mocks.mockJobsFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when the job is missing", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(undefined);
    const job = await getModerationJob(JOB.id);
    expect(job).toBeNull();
  });
});

describe("moderateJob action mapping", () => {
  it("PUBLISH sets PUBLISHED + VERIFIED + lastVerifiedAt and writes an atomic audit", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "actor-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({
        fromStatus: "PENDING_REVIEW",
        toStatus: "PUBLISHED",
        fromVerificationStatus: "PENDING",
        toVerificationStatus: "VERIFIED",
      });
    }
    expect(capturedSets[0].status).toBe("PUBLISHED");
    expect(capturedSets[0].verificationStatus).toBe("VERIFIED");
    expect((capturedSets[0].lastVerifiedAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(capturedAudits[0].action).toBe("JOB_PUBLISHED");
    expect(capturedAudits[0].actorUserId).toBe("actor-1");
    expect(capturedAudits[0].targetType).toBe("job");
    expect(capturedAudits[0].targetId).toBe(JOB.id);
    expect(capturedAudits[0].metadata).toEqual({
      fromStatus: "PENDING_REVIEW",
      toStatus: "PUBLISHED",
      fromVerificationStatus: "PENDING",
      toVerificationStatus: "VERIFIED",
    });
  });

  it("REJECT sets REMOVED and writes JOB_REJECTED without inventing an enum", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REJECT", "actor-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("REMOVED");
    expect(capturedSets[0].verificationStatus).toBe("PENDING");
    expect(capturedAudits[0].action).toBe("JOB_REJECTED");
  });

  it("MARK_INVALID sets verification INVALID and leaves status unchanged", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "MARK_INVALID", "actor-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].verificationStatus).toBe("INVALID");
    expect(capturedSets[0].status).toBe("PENDING_REVIEW");
    expect(capturedAudits[0].action).toBe("JOB_MARKED_INVALID");
  });

  it("REQUEST_REVIEW sets verification NEEDS_REVIEW and leaves status unchanged", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REQUEST_REVIEW", "actor-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].verificationStatus).toBe("NEEDS_REVIEW");
    expect(capturedSets[0].status).toBe("PENDING_REVIEW");
    expect(capturedAudits[0].action).toBe("JOB_REVIEW_REQUESTED");
  });

  it("returns NOT_FOUND for an invalid id without contacting the db", async () => {
    const result = await moderateJob("bad-id", "PUBLISH", "actor-1");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when the job does not exist", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(undefined);
    const result = await moderateJob(JOB.id, "PUBLISH", "actor-1");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns INVALID_ACTION for an unknown action code (defensive)", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const result = await moderateJob(
      JOB.id,
      "HACK" as never,
      "actor-1",
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects PUBLISH on a REMOVED terminal job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "REMOVED" });
    const result = await moderateJob(JOB.id, "PUBLISH", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects REJECT on a REMOVED terminal job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "REMOVED" });
    const result = await moderateJob(JOB.id, "REJECT", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects PUBLISH from PUBLISHED (already published)", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "PUBLISHED" });
    const result = await moderateJob(JOB.id, "PUBLISH", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("allows MARK_INVALID regardless of status", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "REMOVED" });
    const result = await moderateJob(JOB.id, "MARK_INVALID", "actor-1");
    expect(result.ok).toBe(true);
  });

  it("throws (no false success) when the transaction update fails", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    mocks.mockUpdate.mockImplementation(() => ({
      set: () => ({ where: () => Promise.reject(new Error("write failed")) }),
    }));

    await expect(moderateJob(JOB.id, "PUBLISH", "actor-1")).rejects.toThrow(
      "Moderation update failed",
    );
  });
});

describe("getJobAuditHistory", () => {
  it("returns recent events with actor emails, newest first", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e1",
        action: "JOB_PUBLISHED",
        targetType: "job",
        targetId: JOB.id,
        metadata: { toStatus: "PUBLISHED" },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorUserId: "actor-1",
      },
    ]);
    mocks.mockUsersSelect.mockResolvedValue([
      { id: "actor-1", email: "admin@example.com" },
    ]);

    const history = await getJobAuditHistory(JOB.id);
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("JOB_PUBLISHED");
    expect(history[0].actorEmail).toBe("admin@example.com");
    expect(history[0].createdAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns an empty list when there are no events", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    const history = await getJobAuditHistory(JOB.id);
    expect(history).toEqual([]);
  });

  it("does not query users when there are no actor ids (no N+1)", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e2",
        action: "JOB_REJECTED",
        targetType: "job",
        targetId: JOB.id,
        metadata: null,
        createdAt: new Date(),
        actorUserId: null,
      },
    ]);
    const history = await getJobAuditHistory(JOB.id);
    expect(history).toHaveLength(1);
    expect(history[0].actorEmail).toBeNull();
    expect(mocks.mockUsersSelect).not.toHaveBeenCalled();
  });
});
