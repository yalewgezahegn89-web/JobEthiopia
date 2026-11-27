import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockLogInfo: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockSelect(...args),
    update: (...args: unknown[]) => mocks.mockUpdate(...args),
    insert: (...args: unknown[]) => mocks.mockInsert(...args),
  },
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: (...args: unknown[]) => mocks.mockLogInfo(...args),
}));

import { reconcileFacebookObserved } from "../facebookSync";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";

function selectReturns(rows: Array<{ jobId: string }>) {
  mocks.mockSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => Promise.resolve(rows),
      }),
    }),
  });
}

function updateReturns(rows: Array<{ id: string }>) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mocks.mockUpdate.mockReturnValue({ set });
  return { set, where, returning };
}

function insertCapture() {
  const values = vi.fn().mockResolvedValue(undefined);
  mocks.mockInsert.mockReturnValue({ values });
  return values;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reconcileFacebookObserved", () => {
  it("does not flag published jobs when a successful fetch observes no posts", async () => {
    const values = insertCapture();

    const flagged = await reconcileFacebookObserved(SOURCE_ID, []);

    expect(flagged).toBe(0);
    expect(mocks.mockSelect).not.toHaveBeenCalled();
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
    expect(mocks.mockLogInfo).toHaveBeenCalledWith(
      "facebook_reconciliation_skipped_empty_observation",
      { sourceId: SOURCE_ID },
    );
  });

  it("emits no FACEBOOK_POST_MISSING audit rows for an empty observation set", async () => {
    const values = insertCapture();

    await reconcileFacebookObserved(SOURCE_ID, []);

    expect(values).not.toHaveBeenCalled();
  });

  it("does not flag anything when every observed post is still present", async () => {
    selectReturns([]);
    const values = insertCapture();

    const flagged = await reconcileFacebookObserved(SOURCE_ID, [
      "page-1:post-1",
      "page-1:post-2",
    ]);

    expect(flagged).toBe(0);
    expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("flags genuinely missing posts when the observation set is non-empty", async () => {
    selectReturns([{ jobId: "job-missing" }]);
    const { set } = updateReturns([{ id: "job-missing" }]);
    const values = insertCapture();

    const flagged = await reconcileFacebookObserved(SOURCE_ID, [
      "page-1:post-1",
      "page-1:post-2",
    ]);

    expect(flagged).toBe(1);
    expect(mocks.mockSelect).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ verificationStatus: "NEEDS_REVIEW" });

    expect(values).toHaveBeenCalledTimes(1);
    const rows = values.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "FACEBOOK_POST_MISSING",
      targetType: "job",
      targetId: "job-missing",
      metadata: { sourceId: SOURCE_ID },
    });
  });
});
