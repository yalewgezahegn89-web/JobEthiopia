import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTxJobsFindFirst: vi.fn(),
  mockTxApplicationsFindFirst: vi.fn(),
  mockTxInsert: vi.fn(),
  mockTxUpdate: vi.fn(),
  mockApplicationsFindFirst: vi.fn(),
  mockListResult: vi.fn(),
  mockListCount: vi.fn(),
  duplicateInsert: { active: false },
}));

function makeUniqueError() {
  const err = new Error(
    'duplicate key value violates unique constraint "applications_job_id_candidate_user_id_unique"',
  );
  (err as { code?: string }).code = "23505";
  return err;
}

function insertReturning(isAudit: boolean) {
  return () => {
    const called = isAudit;
    if (called) {
      return { values: () => ({}) };
    }
    return {
      values: () => ({
        returning: () => [
          { id: "app-1", status: "SUBMITTED", createdAt: new Date("2026-01-01T00:00:00.000Z") },
        ],
      }),
    };
  };
}

vi.mock("@/db", () => {
  const tx = {
    query: {
      jobs: { findFirst: (...a: unknown[]) => mocks.mockTxJobsFindFirst(...a) },
      applications: { findFirst: (...a: unknown[]) => mocks.mockTxApplicationsFindFirst(...a) },
    },
    insert: (target: unknown) => ({
      values: (v: unknown) => {
        if (mocks.duplicateInsert.active) {
          throw makeUniqueError();
        }
        mocks.mockTxInsert({ target, values: v });
        return {
          returning: () => [
            { id: "app-1", status: "SUBMITTED", createdAt: new Date("2026-01-01T00:00:00.000Z") },
          ],
        };
      },
    }),
    update: (target: unknown) => {
      mocks.mockTxUpdate(target);
      return {
        set: () => ({
          where: () => ({
            returning: () => [
              { id: "app-1", status: "WITHDRAWN", updatedAt: new Date("2026-01-02T00:00:00.000Z") },
            ],
          }),
        }),
      };
    },
  };

  return {
    db: {
      query: {
        applications: { findFirst: (...a: unknown[]) => mocks.mockApplicationsFindFirst(...a) },
      },
      select: (fields: Record<string, unknown>) => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    offset: () => mocks.mockListResult(),
                  }),
                }),
              }),
            }),
          }),
          where: () => {
            if (fields && "count" in fields) {
              return mocks.mockListCount();
            }
            return mocks.mockListResult();
          },
        }),
      }),
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
        return fn(tx);
      },
    },
  };
});

import {
  createApplication,
  listApplicationsForCandidate,
  getOwnedApplication,
  withdrawApplication,
} from "@/lib/applications/dal";

const CANDIDATE = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const APP_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.duplicateInsert.active = false;
});

describe("createApplication", () => {
  it("creates an application atomically when the job is open and publishes an audit event", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue({
      id: JOB_ID,
      status: "PUBLISHED",
      deadline: new Date("2030-01-01T00:00:00.000Z"),
    });

    const result = await createApplication({ jobId: JOB_ID, candidateUserId: CANDIDATE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.status).toBe("SUBMITTED");
      expect(result.item.jobId).toBe(JOB_ID);
    }
    expect(mocks.mockTxInsert).toHaveBeenCalledTimes(2);
    const auditValues = mocks.mockTxInsert.mock.calls[1][0].values;
    expect(auditValues.action).toBe("APPLICATION_SUBMITTED");
    expect(auditValues.actorUserId).toBe(CANDIDATE);
  });

  it("stores the cover letter when provided", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue({
      id: JOB_ID,
      status: "PUBLISHED",
      deadline: null,
    });

    const result = await createApplication({
      jobId: JOB_ID,
      candidateUserId: CANDIDATE,
      coverLetter: "I am a great fit.",
    });
    expect(result.ok).toBe(true);
    const insertValues = mocks.mockTxInsert.mock.calls[0][0].values;
    expect(insertValues.coverLetter).toBe("I am a great fit.");
  });

  it("rejects when the job does not exist", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue(null);
    const result = await createApplication({ jobId: JOB_ID, candidateUserId: CANDIDATE });
    expect(result).toEqual({ ok: false, code: "JOB_NOT_FOUND" });
    expect(mocks.mockTxInsert).not.toHaveBeenCalled();
  });

  it("rejects when the job is not PUBLISHED", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue({ id: JOB_ID, status: "DRAFT", deadline: null });
    const result = await createApplication({ jobId: JOB_ID, candidateUserId: CANDIDATE });
    expect(result).toEqual({ ok: false, code: "JOB_NOT_OPEN" });
    expect(mocks.mockTxInsert).not.toHaveBeenCalled();
  });

  it("rejects when the job deadline has passed", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue({
      id: JOB_ID,
      status: "PUBLISHED",
      deadline: new Date("2000-01-01T00:00:00.000Z"),
    });
    const result = await createApplication({ jobId: JOB_ID, candidateUserId: CANDIDATE });
    expect(result).toEqual({ ok: false, code: "JOB_NOT_OPEN" });
  });

  it("rejects a duplicate application when the unique constraint fires", async () => {
    mocks.mockTxJobsFindFirst.mockResolvedValue({
      id: JOB_ID,
      status: "PUBLISHED",
      deadline: null,
    });
    mocks.duplicateInsert.active = true;

    const result = await createApplication({ jobId: JOB_ID, candidateUserId: CANDIDATE });
    expect(result).toEqual({ ok: false, code: "DUPLICATE" });
  });
});

describe("listApplicationsForCandidate", () => {
  it("returns only the candidate's applications with job + organization info", async () => {
    mocks.mockListResult.mockResolvedValue([
      {
        id: APP_ID,
        jobId: JOB_ID,
        status: "SUBMITTED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        jobTitle: "Accountant",
        organizationName: "ACME Plc",
      },
    ]);
    mocks.mockListCount.mockResolvedValue([{ count: 1 }]);

    const result = await listApplicationsForCandidate(CANDIDATE, { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.items[0].jobTitle).toBe("Accountant");
    expect(result.items[0].organizationName).toBe("ACME Plc");
    expect(typeof result.items[0].createdAt).toBe("string");
  });
});

describe("getOwnedApplication", () => {
  it("returns the application when it belongs to the candidate", async () => {
    mocks.mockApplicationsFindFirst.mockResolvedValue({
      id: APP_ID,
      jobId: JOB_ID,
      status: "SUBMITTED",
      coverLetter: "hello",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const result = await getOwnedApplication(APP_ID, CANDIDATE);
    expect(result?.id).toBe(APP_ID);
  });

  it("returns null for a non-owned application id", async () => {
    mocks.mockApplicationsFindFirst.mockResolvedValue(null);
    const result = await getOwnedApplication(APP_ID, CANDIDATE);
    expect(result).toBeNull();
  });

  it("returns null for a malformed id without querying the database", async () => {
    const result = await getOwnedApplication("not-a-uuid", CANDIDATE);
    expect(result).toBeNull();
    expect(mocks.mockApplicationsFindFirst).not.toHaveBeenCalled();
  });
});

describe("withdrawApplication", () => {
  it("withdraws the candidate's own application and publishes an audit event", async () => {
    mocks.mockTxApplicationsFindFirst.mockResolvedValue({
      id: APP_ID,
      jobId: JOB_ID,
      status: "SUBMITTED",
    });

    const result = await withdrawApplication(APP_ID, CANDIDATE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.status).toBe("WITHDRAWN");
    }
    expect(mocks.mockTxUpdate).toHaveBeenCalledTimes(1);
    const auditValues = mocks.mockTxInsert.mock.calls[0][0].values;
    expect(auditValues.action).toBe("APPLICATION_WITHDRAWN");
    expect(auditValues.metadata).toEqual(
      expect.objectContaining({ fromStatus: "SUBMITTED", toStatus: "WITHDRAWN" }),
    );
  });

  it("returns NOT_FOUND when the application does not belong to the candidate", async () => {
    mocks.mockTxApplicationsFindFirst.mockResolvedValue(null);
    const result = await withdrawApplication(APP_ID, CANDIDATE);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
  });

  it("returns ALREADY_WITHDRAWN when the application is already withdrawn", async () => {
    mocks.mockTxApplicationsFindFirst.mockResolvedValue({
      id: APP_ID,
      jobId: JOB_ID,
      status: "WITHDRAWN",
    });
    const result = await withdrawApplication(APP_ID, CANDIDATE);
    expect(result).toEqual({ ok: false, code: "ALREADY_WITHDRAWN" });
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a malformed id without touching the database", async () => {
    const result = await withdrawApplication("junk", CANDIDATE);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTxApplicationsFindFirst).not.toHaveBeenCalled();
  });
});
