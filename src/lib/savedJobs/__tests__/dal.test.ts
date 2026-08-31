import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSavedFindFirst: vi.fn(),
  mockJobRead: vi.fn(),
  mockSave: vi.fn(),
  mockDelete: vi.fn(),
  mockListResult: vi.fn(),
  mockCount: vi.fn(),
  duplicateInsert: { active: false },
}));

function makeUniqueError() {
  const err = new Error(
    'duplicate key value violates unique constraint "saved_jobs_candidate_user_id_job_id_unique"',
  );
  (err as { code?: string }).code = "23505";
  return err;
}

vi.mock("@/db", () => {
  const countThenable = () => {
    const result = mocks.mockCount();
    return {
      limit: () => mocks.mockJobRead(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      catch: () => Promise.resolve(result),
      finally: () => Promise.resolve(result),
    };
  };

  return {
    db: {
      query: {
        savedJobs: {
          findFirst: (...a: unknown[]) => mocks.mockSavedFindFirst(...a),
        },
      },
      select: () => ({
        from: () => ({
          where: () => countThenable(),
          innerJoin: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: () => ({
                      offset: () => mocks.mockListResult(),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
      insert: () => ({
        values: () => {
          if (mocks.duplicateInsert.active) {
            throw makeUniqueError();
          }
          mocks.mockSave();
          return {};
        },
      }),
      delete: () => ({
        where: () => mocks.mockDelete(),
      }),
    },
  };
});

import {
  saveJob,
  unsaveJob,
  isJobSaved,
  listSavedJobs,
  getSavedJobsCount,
} from "@/lib/savedJobs/dal";

const CANDIDATE = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.duplicateInsert.active = false;
});

describe("saveJob", () => {
  it("saves a PUBLISHED job", async () => {
    mocks.mockJobRead.mockReturnValue([{ id: JOB_ID, status: "PUBLISHED" }]);
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: true, saved: true, jobId: JOB_ID });
    expect(mocks.mockSave).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing job", async () => {
    mocks.mockJobRead.mockReturnValue([]);
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: false, code: "JOB_NOT_FOUND" });
    expect(mocks.mockSave).not.toHaveBeenCalled();
  });

  it("rejects a non-PUBLISHED job", async () => {
    mocks.mockJobRead.mockReturnValue([{ id: JOB_ID, status: "DRAFT" }]);
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: false, code: "JOB_NOT_SAVEABLE" });
    expect(mocks.mockSave).not.toHaveBeenCalled();
  });

  it("rejects an EXPIRED job", async () => {
    mocks.mockJobRead.mockReturnValue([{ id: JOB_ID, status: "EXPIRED" }]);
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: false, code: "JOB_NOT_SAVEABLE" });
  });

  it("rejects a REMOVED job", async () => {
    mocks.mockJobRead.mockReturnValue([{ id: JOB_ID, status: "REMOVED" }]);
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: false, code: "JOB_NOT_SAVEABLE" });
  });

  it("treats a duplicate save idempotently", async () => {
    mocks.mockJobRead.mockReturnValue([{ id: JOB_ID, status: "PUBLISHED" }]);
    mocks.duplicateInsert.active = true;
    const result = await saveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: true, saved: true, jobId: JOB_ID });
  });

  it("returns JOB_NOT_FOUND for a malformed job id", async () => {
    const result = await saveJob(CANDIDATE, "not-a-uuid");
    expect(result).toEqual({ ok: false, code: "JOB_NOT_FOUND" });
    expect(mocks.mockSave).not.toHaveBeenCalled();
  });
});

describe("unsaveJob", () => {
  it("deletes a saved row scoped to the candidate and job", async () => {
    mocks.mockDelete.mockResolvedValue(undefined);
    const result = await unsaveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: true });
    expect(mocks.mockDelete).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when the saved row does not exist", async () => {
    mocks.mockDelete.mockResolvedValue(undefined);
    const result = await unsaveJob(CANDIDATE, JOB_ID);
    expect(result).toEqual({ ok: true });
  });

  it("does not query the DB for a malformed job id", async () => {
    const result = await unsaveJob(CANDIDATE, "junk");
    expect(result).toEqual({ ok: true });
    expect(mocks.mockDelete).not.toHaveBeenCalled();
  });
});

describe("isJobSaved", () => {
  it("returns true when a saved row exists", async () => {
    mocks.mockSavedFindFirst.mockResolvedValue({ id: "88888888-8888-4888-8888-888888888888" });
    const result = await isJobSaved(CANDIDATE, JOB_ID);
    expect(result).toBe(true);
  });

  it("returns false when no saved row exists", async () => {
    mocks.mockSavedFindFirst.mockResolvedValue(undefined);
    const result = await isJobSaved(CANDIDATE, JOB_ID);
    expect(result).toBe(false);
  });

  it("returns false for a malformed job id without querying", async () => {
    const result = await isJobSaved(CANDIDATE, "bad");
    expect(result).toBe(false);
    expect(mocks.mockSavedFindFirst).not.toHaveBeenCalled();
  });
});

describe("listSavedJobs", () => {
  it("returns only the candidate's rows with job + org + location info and no candidate identity", async () => {
    mocks.mockListResult.mockResolvedValue([
      {
        id: "88888888-8888-4888-8888-888888888888",
        jobId: JOB_ID,
        title: "Accountant",
        slug: "accountant",
        organizationName: "ACME Plc",
        locationName: "Addis Ababa",
        deadline: new Date("2030-01-01T00:00:00.000Z"),
        jobStatus: "PUBLISHED",
        savedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mocks.mockCount.mockResolvedValue([{ count: 1 }]);

    const result = await listSavedJobs(CANDIDATE, { page: 1, limit: 20 });
    const first = result.items[0];
    expect(result.total).toBe(1);
    expect(first.title).toBe("Accountant");
    expect(first.organizationName).toBe("ACME Plc");
    expect(first.locationName).toBe("Addis Ababa");
    expect(typeof first.deadline).toBe("string");
    expect(typeof first.savedAt).toBe("string");
    expect(Object.prototype.hasOwnProperty.call(first, "candidateUserId")).toBe(false);
  });

  it("paginates empty results", async () => {
    mocks.mockListResult.mockResolvedValue([]);
    mocks.mockCount.mockResolvedValue([{ count: 0 }]);
    const result = await listSavedJobs(CANDIDATE, { page: 5, limit: 20 });
    expect(result.page).toBe(5);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });
});

describe("getSavedJobsCount", () => {
  it("returns the candidate's saved count", async () => {
    mocks.mockCount.mockResolvedValue([{ value: 3 }]);
    const result = await getSavedJobsCount(CANDIDATE);
    expect(result).toBe(3);
  });
});
