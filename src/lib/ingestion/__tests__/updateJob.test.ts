import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  jobRow: {} as Record<string, unknown> | undefined,
  jobSelectCalls: 0,
  jobUpdateCalls: 0,
  jobUpdateValues: {} as Record<string, unknown>,
  jobSourceUpdateCalls: 0,
  jobSourceUpdateValues: {} as Record<string, unknown>,
}));

vi.mock("../../../db", () => ({
  db: {
    transaction: (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                mocks.jobSelectCalls += 1;
                return Promise.resolve(
                  mocks.jobRow ? [mocks.jobRow] : [],
                );
              },
            }),
          }),
        }),
        update: () => ({
          set: (values: Record<string, unknown>) => {
            if (Object.prototype.hasOwnProperty.call(values, "rawHash")) {
              mocks.jobSourceUpdateCalls += 1;
              mocks.jobSourceUpdateValues = values;
            } else {
              mocks.jobUpdateCalls += 1;
              mocks.jobUpdateValues = values;
            }
            return {
              where: () => Promise.resolve([]),
            };
          },
        }),
      }),
  },
}));

import { updateJob } from "../updateJob";

const INPUT = {
  jobId: "job-1",
  jobSourceId: "js-1",
  normalizedTitle: "Updated Title",
  normalizedDescription: "Updated description",
  locationId: null,
  professionId: null,
  categoryId: null,
  employmentType: "FULL_TIME",
  salaryMin: 5000,
  salaryMax: 8000,
  salaryCurrency: "ETB",
  salaryPeriod: "MONTHLY",
  experienceMin: 3,
  experienceMax: 5,
  responsibilities: null,
  requirements: "Updated requirements",
  educationRequirements: null,
  benefits: null,
  postedAt: null,
  deadline: null,
  applicationUrl: "https://example.com/job/1",
  rawHash: "new-hash",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.jobRow = { id: "job-1", status: "DRAFT" };
  mocks.jobSelectCalls = 0;
  mocks.jobUpdateCalls = 0;
  mocks.jobSourceUpdateCalls = 0;
});

describe("updateJob", () => {
  it("updates content and returns true for a non-published job", async () => {
    const result = await updateJob(INPUT);

    expect(result).toBe(true);
    expect(mocks.jobUpdateCalls).toBe(1);
    expect(mocks.jobUpdateValues.title).toBe("Updated Title");
    expect(mocks.jobUpdateValues.requirements).toBe("Updated requirements");
    expect(mocks.jobSourceUpdateCalls).toBe(1);
    expect(mocks.jobSourceUpdateValues.rawHash).toBe("new-hash");
  });

  it("still updates DRAFT and PENDING_REVIEW jobs (returns true)", async () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "EXPIRED", "REMOVED"]) {
      mocks.jobRow = { id: "job-1", status };
      const result = await updateJob(INPUT);
      expect(result).toBe(true);
      expect(mocks.jobUpdateCalls).toBe(1);
      mocks.jobUpdateCalls = 0;
    }
  });

  it("does not rewrite content of a PUBLISHED job but still refreshes the linkage", async () => {
    mocks.jobRow = { id: "job-1", status: "PUBLISHED" };

    const result = await updateJob(INPUT);

    expect(result).toBe(false);
    expect(mocks.jobUpdateCalls).toBe(0);
    expect(mocks.jobSourceUpdateCalls).toBe(1);
    expect(mocks.jobSourceUpdateValues.rawHash).toBe("new-hash");
    expect(mocks.jobSourceUpdateValues.lastSeenAt).toBeInstanceOf(Date);
  });

  it("returns true when the job row cannot be found (matches update-applied semantics)", async () => {
    mocks.jobRow = undefined;

    const result = await updateJob(INPUT);

    expect(result).toBe(true);
    expect(mocks.jobSourceUpdateCalls).toBe(1);
  });
});