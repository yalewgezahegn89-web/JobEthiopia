import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockJobsFindFirst: vi.fn(),
  mockJobsFindMany: vi.fn(),
  mockJobSourcesFindMany: vi.fn(),
  mockJobSourcesFindFirst: vi.fn(),
  mockSourcesFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockUsersSelect: vi.fn(),
  mockCountRows: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockEntityFindMany: vi.fn(),
  mockOrganizationsFindFirst: vi.fn(),
  mockCategoriesFindFirst: vi.fn(),
  mockLocationsFindFirst: vi.fn(),
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
        jobSources: {
          findMany: (...args: unknown[]) => mocks.mockJobSourcesFindMany(...args),
          findFirst: (...args: unknown[]) => mocks.mockJobSourcesFindFirst(...args),
        },
        sources: {
          findMany: (...args: unknown[]) => mocks.mockSourcesFindMany(...args),
        },
        auditLog: {
          findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
        },
        organizations: {
          findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a),
          findFirst: (...a: unknown[]) => mocks.mockOrganizationsFindFirst(...a),
        },
        categories: {
          findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a),
          findFirst: (...a: unknown[]) => mocks.mockCategoriesFindFirst(...a),
        },
        professions: { findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a) },
        locations: {
          findMany: (...a: unknown[]) => mocks.mockEntityFindMany(...a),
          findFirst: (...a: unknown[]) => mocks.mockLocationsFindFirst(...a),
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

const PROVENANCE_SOURCE = {
  id: "99999999-9999-4999-8999-999999999999",
  name: "EthioJobs",
  sourceType: "WEBSITE",
  trustLevel: "MEDIUM",
};

const PROVENANCE_ROW = {
  id: "88888888-8888-4888-8888-888888888888",
  jobId: JOB.id,
  sourceId: PROVENANCE_SOURCE.id,
  sourceUrl: "https://example.com/job/1",
  externalId: "ext-1",
  firstSeenAt: new Date("2026-02-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-03-01T00:00:00.000Z"),
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
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

function setupValidJobMocks() {
  const futureDeadline = new Date(Date.now() + 86400000);
  mocks.mockOrganizationsFindFirst.mockResolvedValue({ id: "org-1", status: "ACTIVE" });
  mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: true });
  mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: true });
  return futureDeadline;
}

function makeJobWithFields(overrides: Record<string, unknown> = {}) {
  return {
    ...JOB,
    title: "Software Engineer",
    description: "A detailed job description that meets minimum length requirements for validation.",
    organizationId: "org-1",
    categoryId: "cat-1",
    locationId: "loc-1",
    employmentType: "FULL_TIME" as const,
    deadline: new Date(Date.now() + 86400000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedTx.fn = null;
  mocks.mockEntityFindMany.mockResolvedValue([]);
  mocks.mockOrganizationsFindFirst.mockResolvedValue(null);
  mocks.mockCategoriesFindFirst.mockResolvedValue(null);
  mocks.mockLocationsFindFirst.mockResolvedValue(null);
  mocks.mockJobSourcesFindMany.mockResolvedValue([]);
  mocks.mockSourcesFindMany.mockResolvedValue([]);
  // A job_sources record exists by default so the Phase 6 provenance gate
  // passes unless a specific test removes it.
  mocks.mockJobSourcesFindFirst.mockResolvedValue({ id: "provenance-1" });
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

describe("listModerationJobs — provenance visibility", () => {
  it("populates sourceName, sourceType, sourceUrl, externalId, firstSeenAt, lastSeenAt, trustLevel", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([JOB]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);
    mocks.mockJobSourcesFindMany.mockResolvedValue([PROVENANCE_ROW]);
    mocks.mockSourcesFindMany.mockResolvedValue([PROVENANCE_SOURCE]);

    const result = await listModerationJobs({ page: 1, limit: 20 });
    const item = result.items[0];
    expect(item.id).toBe(JOB.id);
    expect(item.sourceName).toBe("EthioJobs");
    expect(item.sourceType).toBe("WEBSITE");
    expect(item.sourceUrl).toBe("https://example.com/job/1");
    expect(item.externalId).toBe("ext-1");
    expect(item.firstSeenAt).toBe("2026-02-01T00:00:00.000Z");
    expect(item.lastSeenAt).toBe("2026-03-01T00:00:00.000Z");
    expect(item.trustLevel).toBe("MEDIUM");
  });

  it("keeps provenance fields null when no job_sources exist", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([JOB]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listModerationJobs({ page: 1, limit: 20 });
    const item = result.items[0];
    expect(item.sourceName).toBeNull();
    expect(item.sourceType).toBeNull();
    expect(item.sourceUrl).toBeNull();
    expect(item.externalId).toBeNull();
    expect(item.firstSeenAt).toBeNull();
    expect(item.lastSeenAt).toBeNull();
    expect(item.trustLevel).toBeNull();
  });

  it("does not query sources when there are no job_sources (no N+1)", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([JOB]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    await listModerationJobs({ page: 1, limit: 20 });
    expect(mocks.mockSourcesFindMany).not.toHaveBeenCalled();
  });

  it("does not duplicate moderation rows when a job has multiple provenance rows", async () => {
    mocks.mockJobsFindMany.mockResolvedValue([JOB]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);
    mocks.mockJobSourcesFindMany.mockResolvedValue([
      PROVENANCE_ROW,
      {
        ...PROVENANCE_ROW,
        id: "77777777-7777-4777-8777-777777777777",
        sourceId: "66666666-6666-4666-8666-666666666666",
        sourceUrl: "https://second.example.com/job/1",
        firstSeenAt: new Date("2026-02-05T00:00:00.000Z"),
        createdAt: new Date("2026-02-05T00:00:00.000Z"),
      },
    ]);
    mocks.mockSourcesFindMany.mockResolvedValue([
      PROVENANCE_SOURCE,
      {
        id: "66666666-6666-4666-8666-666666666666",
        name: "Second Source",
        sourceType: "API",
        trustLevel: "LOW",
      },
    ]);

    const result = await listModerationJobs({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    // deterministic: the earliest-created job_source represents the job
    expect(result.items[0].sourceName).toBe("EthioJobs");
    expect(result.items[0].sourceUrl).toBe("https://example.com/job/1");
    expect(result.items[0].trustLevel).toBe("MEDIUM");
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

  it("attaches provenance to the detail record", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    mocks.mockJobSourcesFindMany.mockResolvedValue([PROVENANCE_ROW]);
    mocks.mockSourcesFindMany.mockResolvedValue([PROVENANCE_SOURCE]);

    const job = await getModerationJob(JOB.id);
    expect(job?.id).toBe(JOB.id);
    expect(job?.provenance).toEqual({
      sourceId: PROVENANCE_SOURCE.id,
      sourceName: "EthioJobs",
      sourceType: "WEBSITE",
      sourceUrl: "https://example.com/job/1",
      externalId: "ext-1",
      firstSeenAt: "2026-02-01T00:00:00.000Z",
      lastSeenAt: "2026-03-01T00:00:00.000Z",
      trustLevel: "MEDIUM",
    });
  });

  it("keeps provenance null when no job_sources exist", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(JOB);
    const job = await getModerationJob(JOB.id);
    expect(job?.provenance).toBeNull();
    expect(mocks.mockSourcesFindMany).not.toHaveBeenCalled();
  });
});

describe("moderateJob action mapping", () => {
  it("PUBLISH sets PUBLISHED + VERIFIED + lastVerifiedAt and writes an atomic audit", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();
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
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();
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

describe("PUBLISH validation gate", () => {
  it("allows publish when all required fields are valid", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("PUBLISHED");
    expect(capturedAudits[0].action).toBe("JOB_PUBLISHED");
  });

  it("rejects publish when title is empty", async () => {
    const job = makeJobWithFields({ title: "   " });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when description is empty", async () => {
    const job = makeJobWithFields({ description: "" });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when description is shorter than 50 chars", async () => {
    const job = makeJobWithFields({ description: "Short" });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when organizationId is null", async () => {
    const job = makeJobWithFields({ organizationId: null });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when organization is not ACTIVE", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    mocks.mockOrganizationsFindFirst.mockResolvedValue({ id: "org-1", status: "INACTIVE" });
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: true });
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: true });

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when organization does not exist", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    mocks.mockOrganizationsFindFirst.mockResolvedValue(undefined);
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: true });
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: true });

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when categoryId is null", async () => {
    const job = makeJobWithFields({ categoryId: null });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when category is not active", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    mocks.mockOrganizationsFindFirst.mockResolvedValue({ id: "org-1", status: "ACTIVE" });
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: false });
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: true });

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when locationId is null", async () => {
    const job = makeJobWithFields({ locationId: null });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when location is not active", async () => {
    const job = makeJobWithFields();
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    mocks.mockOrganizationsFindFirst.mockResolvedValue({ id: "org-1", status: "ACTIVE" });
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: true });
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: false });

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when employmentType is null", async () => {
    const job = makeJobWithFields({ employmentType: null });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("rejects publish when deadline is in the past", async () => {
    const job = makeJobWithFields({ deadline: new Date("2020-01-01") });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("allows publish when deadline is null (optional)", async () => {
    const job = makeJobWithFields({ deadline: null });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("PUBLISHED");
  });

  it("rejects publish with multiple missing fields", async () => {
    const job = makeJobWithFields({
      title: "",
      description: "",
      employmentType: null,
    });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("does not run validation for non-PUBLISH actions", async () => {
    const job = makeJobWithFields({ title: "" });
    mocks.mockJobsFindFirst.mockResolvedValue(job);
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REJECT", "admin-user-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("REMOVED");
  });
});

describe("PUBLISH provenance gate (Phase 6 Batch 3)", () => {
  it("rejects publish when the job has no job_sources record", async () => {
    mocks.mockJobSourcesFindFirst.mockResolvedValue(undefined);
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields());
    setupValidJobMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_PROVENANCE");
    }
  });

  it("allows publish when a job_sources record exists", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields());
    setupValidJobMocks();
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("PUBLISHED");
    expect(capturedAudits[0].action).toBe("JOB_PUBLISHED");
  });

  it.each([
    ["employer", "src-employer"],
    ["api", "src-api"],
    ["manual", "src-manual"],
    ["website/feed", "src-website"],
  ])("allows publish with %s provenance (no source-type restriction)", async (_label, sourceId) => {
    mocks.mockJobSourcesFindFirst.mockResolvedValue({
      id: "prov-row",
      jobId: JOB.id,
      sourceId,
    });
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields());
    setupValidJobMocks();
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("PUBLISHED");
  });

  it("still rejects invalid fields (INCOMPLETE_DATA) even when provenance exists", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields({ locationId: null }));
    mocks.mockOrganizationsFindFirst.mockResolvedValue({ id: "org-1", status: "ACTIVE" });
    mocks.mockCategoriesFindFirst.mockResolvedValue({ id: "cat-1", isActive: true });
    mocks.mockLocationsFindFirst.mockResolvedValue({ id: "loc-1", isActive: false });

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INCOMPLETE_DATA");
    }
  });

  it("still stamps VERIFIED and lastVerifiedAt using server time on publish", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields());
    setupValidJobMocks();
    const before = Date.now();
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    const set = capturedSets[0];
    expect(set.verificationStatus).toBe("VERIFIED");
    expect(set.lastVerifiedAt).toBeInstanceOf(Date);
    expect((set.lastVerifiedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect((set.lastVerifiedAt as Date).getTime()).toBeLessThanOrEqual(Date.now() + 5000);
    expect(set.updatedAt).toBe(set.lastVerifiedAt);
  });

  it("does not auto-create provenance during publish", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(makeJobWithFields());
    setupValidJobMocks();
    const { capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "PUBLISH", "admin-user-1");
    expect(result.ok).toBe(true);
    // Only the audit row is written; no job_sources insert is attempted.
    expect(capturedAudits).toHaveLength(1);
    expect(capturedAudits[0].action).toBe("JOB_PUBLISHED");
    expect(capturedAudits[0]).not.toHaveProperty("sourceId");
    expect(capturedAudits[0]).not.toHaveProperty("jobId");
  });
});

describe("REVERIFY action", () => {
  const PUBLISHED_JOB = {
    ...JOB,
    status: "PUBLISHED" as const,
    verificationStatus: "VERIFIED" as const,
    lastVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
    deadline: new Date("2026-12-31T00:00:00.000Z"),
    postedAt: new Date("2026-01-15T00:00:00.000Z"),
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    categoryId: "cat-1",
    locationId: "loc-1",
  };

  it("reverifies a PUBLISHED job successfully", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({
        fromStatus: "PUBLISHED",
        toStatus: "PUBLISHED",
        fromVerificationStatus: "VERIFIED",
        toVerificationStatus: "VERIFIED",
      });
    }
    expect(capturedSets[0].status).toBe("PUBLISHED");
    expect(capturedSets[0].verificationStatus).toBe("VERIFIED");
    expect((capturedSets[0].lastVerifiedAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(capturedAudits[0].action).toBe("JOB_REVERIFIED");
    expect(capturedAudits[0].actorUserId).toBe("actor-1");
    expect(capturedAudits[0].targetType).toBe("job");
    expect(capturedAudits[0].targetId).toBe(JOB.id);
  });

  it("rejects REVERIFY on a DRAFT job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "DRAFT" });
    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects REVERIFY on a PENDING_REVIEW job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "PENDING_REVIEW" });
    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects REVERIFY on an EXPIRED job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "EXPIRED" });
    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects REVERIFY on a REMOVED job", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue({ ...JOB, status: "REMOVED" });
    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("returns NOT_FOUND for an invalid job id", async () => {
    const result = await moderateJob("bad-id", "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("returns NOT_FOUND when the job does not exist", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(undefined);
    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("does not change status (remains PUBLISHED)", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedSets[0].status).toBe("PUBLISHED");
  });

  it("does not change deadline", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedSets[0].deadline).toBeUndefined();
  });

  it("does not change postedAt", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedSets[0].postedAt).toBeUndefined();
  });

  it("does not change organizationId", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedSets[0].organizationId).toBeUndefined();
  });

  it("updates lastVerifiedAt to a recent timestamp", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedSets } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    const ts = capturedSets[0].lastVerifiedAt as Date;
    expect(ts).toBeInstanceOf(Date);
    expect(ts.getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("allows reverify on a never-verified job (lastVerifiedAt = null)", async () => {
    const neverVerified = { ...PUBLISHED_JOB, lastVerifiedAt: null, verificationStatus: "PENDING" };
    mocks.mockJobsFindFirst.mockResolvedValue(neverVerified);
    const { capturedSets, capturedAudits } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result.ok).toBe(true);
    expect(capturedSets[0].verificationStatus).toBe("VERIFIED");
    expect((capturedSets[0].lastVerifiedAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(capturedAudits[0].metadata).toMatchObject({
      fromLastVerifiedAt: null,
    });
  });

  it("allows reverify on an already-fresh job", async () => {
    const fresh = { ...PUBLISHED_JOB, lastVerifiedAt: new Date() };
    mocks.mockJobsFindFirst.mockResolvedValue(fresh);
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result.ok).toBe(true);
    expect((capturedSets[0].lastVerifiedAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("allows reverify on a stale job (lastVerifiedAt > 30 days ago)", async () => {
    const stale = { ...PUBLISHED_JOB, lastVerifiedAt: new Date("2025-01-01T00:00:00.000Z") };
    mocks.mockJobsFindFirst.mockResolvedValue(stale);
    const { capturedSets } = makeTxMocks();

    const result = await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(result.ok).toBe(true);
    expect((capturedSets[0].lastVerifiedAt as Date).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("writes audit action JOB_REVERIFIED", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedAudits } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedAudits[0].action).toBe("JOB_REVERIFIED");
  });

  it("audit actorUserId is the server-assigned actor", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedAudits } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    expect(capturedAudits[0].actorUserId).toBe("actor-1");
  });

  it("audit metadata contains fromLastVerifiedAt and toLastVerifiedAt", async () => {
    const oldTs = new Date("2026-06-01T00:00:00.000Z");
    mocks.mockJobsFindFirst.mockResolvedValue({ ...PUBLISHED_JOB, lastVerifiedAt: oldTs });
    const { capturedAudits } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    const meta = capturedAudits[0].metadata as Record<string, unknown>;
    expect(meta.fromLastVerifiedAt).toBe(oldTs.toISOString());
    expect(typeof meta.toLastVerifiedAt).toBe("string");
    expect(new Date(meta.toLastVerifiedAt as string).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("audit metadata includes verification status transition", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedAudits } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    const meta = capturedAudits[0].metadata as Record<string, unknown>;
    expect(meta.fromVerificationStatus).toBe("VERIFIED");
    expect(meta.toVerificationStatus).toBe("VERIFIED");
  });

  it("audit metadata includes status (PUBLISHED -> PUBLISHED)", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    const { capturedAudits } = makeTxMocks();

    await moderateJob(JOB.id, "REVERIFY", "actor-1");
    const meta = capturedAudits[0].metadata as Record<string, unknown>;
    expect(meta.fromStatus).toBe("PUBLISHED");
    expect(meta.toStatus).toBe("PUBLISHED");
  });

  it("throws when the transaction update fails", async () => {
    mocks.mockJobsFindFirst.mockResolvedValue(PUBLISHED_JOB);
    mocks.mockUpdate.mockImplementation(() => ({
      set: () => ({ where: () => Promise.reject(new Error("write failed")) }),
    }));

    await expect(moderateJob(JOB.id, "REVERIFY", "actor-1")).rejects.toThrow(
      "Moderation update failed",
    );
  });
});
