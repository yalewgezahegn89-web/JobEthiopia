import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

import { correctDraftJob } from "@/lib/admin/jobs";

const JOB_ID = "a139e20c-b2d9-4ce4-a0ba-58e934d3a081";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_DEADLINE = new Date("2099-11-19T20:55:00.000Z");
const FUTURE_ISO = NEW_DEADLINE.toISOString();

const DRAFT_JOB = {
  id: JOB_ID,
  status: "DRAFT",
  deadline: new Date("2099-11-01T20:55:00.000Z"),
  description: "Old description ".padEnd(80, "x"),
  requirements: "Old requirements",
};

function buildTx(jobRows: unknown[] = [DRAFT_JOB]) {
  const selectChain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(() => Promise.resolve(jobRows)),
  };
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.limit.mockReturnValue(selectChain);

  const select = vi.fn(() => selectChain);

  const updateWhere = vi.fn(() => Promise.resolve());
  const set = vi.fn((patch: Record<string, unknown>) => {
    void patch;
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set }));

  const values = vi.fn(() => Promise.resolve());
  const insert = vi.fn(() => ({ values }));

  const tx = { select, update, insert };
  return { tx, selectChain, update, set, updateWhere, insert, values };
}

function runWithTx(tx: unknown) {
  mocks.mockTransaction.mockImplementation(
    async (callback: (t: unknown) => unknown) => callback(tx),
  );
}

const VALID_INPUT = {
  deadline: NEW_DEADLINE,
  description: "Corrected official description ".padEnd(80, "y"),
  requirements: "Corrected official requirements",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("correctDraftJob — validation", () => {
  it("returns NOT_FOUND for an invalid job id without a transaction", async () => {
    const result = await correctDraftJob(
      "not-a-uuid",
      VALID_INPUT,
      ACTOR_ID,
    );
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT for an invalid deadline or short description", async () => {
    const badDeadline = await correctDraftJob(
      JOB_ID,
      { ...VALID_INPUT, deadline: new Date("invalid") },
      ACTOR_ID,
    );
    const shortDescription = await correctDraftJob(
      JOB_ID,
      { ...VALID_INPUT, description: "too short" },
      ACTOR_ID,
    );

    expect(badDeadline).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(shortDescription).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });
});

describe("correctDraftJob — guard rails", () => {
  it("returns NOT_FOUND when the job does not exist", async () => {
    const { tx, update, insert } = buildTx([]);
    runWithTx(tx);

    const result = await correctDraftJob(JOB_ID, VALID_INPUT, ACTOR_ID);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "EXPIRED", "REMOVED"])(
    "returns NOT_DRAFT for a %s job without writing",
    async (status) => {
      const { tx, update, insert } = buildTx([{ ...DRAFT_JOB, status }]);
      runWithTx(tx);

      const result = await correctDraftJob(JOB_ID, VALID_INPUT, ACTOR_ID);

      expect(result).toEqual({ ok: false, code: "NOT_DRAFT" });
      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("locks the job row before deciding", async () => {
    const { tx, selectChain } = buildTx();
    runWithTx(tx);

    await correctDraftJob(JOB_ID, VALID_INPUT, ACTOR_ID);

    expect(selectChain.for).toHaveBeenCalledWith("update");
  });
});

describe("correctDraftJob — allowed fields only", () => {
  it("updates only deadline, description, requirements, and updatedAt", async () => {
    const { tx, set, values } = buildTx();
    runWithTx(tx);

    const result = await correctDraftJob(JOB_ID, VALID_INPUT, ACTOR_ID);

    expect(result).toEqual({
      ok: true,
      changedFields: ["deadline", "description", "requirements"],
    });
    expect(set).toHaveBeenCalledTimes(1);
    const patch = set.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(
      ["deadline", "description", "requirements", "updatedAt"].sort(),
    );
    expect(patch.deadline).toBe(NEW_DEADLINE);
    expect(patch.description).toBe(VALID_INPUT.description);
    expect(patch.requirements).toBe(VALID_INPUT.requirements);
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("verificationStatus");
    expect(patch).not.toHaveProperty("categoryId");
    expect(patch).not.toHaveProperty("organizationId");
    expect(patch).not.toHaveProperty("sourceId");

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: ACTOR_ID,
        action: "JOB_DRAFT_CORRECTED",
        targetType: "job",
        targetId: JOB_ID,
        metadata: expect.objectContaining({
          changedFields: ["deadline", "description", "requirements"],
          deadlineBefore: DRAFT_JOB.deadline.toISOString(),
          deadlineAfter: FUTURE_ISO,
          requirementsChanged: true,
          status: "DRAFT",
        }),
      }),
    );
  });

  it("writes nothing when the correction is a no-op", async () => {
    const { tx, update, insert } = buildTx([
      {
        ...DRAFT_JOB,
        deadline: NEW_DEADLINE,
        description: VALID_INPUT.description,
        requirements: VALID_INPUT.requirements,
      },
    ]);
    runWithTx(tx);

    const result = await correctDraftJob(JOB_ID, VALID_INPUT, ACTOR_ID);

    expect(result).toEqual({ ok: true, changedFields: [] });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("accepts an empty requirements value as null", async () => {
    const { tx, set } = buildTx([
      { ...DRAFT_JOB, requirements: "Old requirements" },
    ]);
    runWithTx(tx);

    const result = await correctDraftJob(
      JOB_ID,
      { ...VALID_INPUT, requirements: null },
      ACTOR_ID,
    );

    expect(result).toEqual({
      ok: true,
      changedFields: ["deadline", "description", "requirements"],
    });
    const patch = set.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.requirements).toBeNull();
  });
});
