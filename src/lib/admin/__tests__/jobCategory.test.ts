import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
    select: (...args: unknown[]) => mocks.mockSelect(...args),
  },
}));

import {
  assignJobCategory,
  listActiveJobCategories,
} from "@/lib/admin/jobs";

const JOB_ID = "a139e20c-b2d9-4ce4-a0ba-58e934d3a081";
const CATEGORY_ID = "852af5d8-b7a9-4825-a251-00cc2087f0e5";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const DRAFT_JOB = {
  id: JOB_ID,
  status: "DRAFT",
  verificationStatus: "PENDING",
  categoryId: null,
};

const WASH = {
  id: CATEGORY_ID,
  name: "Water, Sanitation and Hygiene (WASH)",
  isActive: true,
};

function queryChain(rows: unknown[]) {
  type Chain = {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    for: ReturnType<typeof vi.fn>;
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>;
  };
  const chain = {} as Chain;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => Promise.resolve(rows));
  chain.for = vi.fn(() => Promise.resolve(rows));
  chain.then = (resolve: (value: unknown[]) => unknown) =>
    Promise.resolve(rows).then(resolve);
  return chain;
}

function buildTx({
  jobRows = [] as unknown[],
  categoryRows = [] as unknown[],
} = {}) {
  const jobSelect = queryChain(jobRows);
  const categorySelect = queryChain(categoryRows);
  const select = vi
    .fn()
    .mockReturnValueOnce(jobSelect)
    .mockReturnValueOnce(categorySelect);

  const updateWhere = vi.fn(() => Promise.resolve());
  const set = vi.fn((patch: Record<string, unknown>) => {
    void patch;
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set }));

  const values = vi.fn(() => Promise.resolve());
  const insert = vi.fn(() => ({ values }));

  const tx = { select, update, insert };
  return {
    tx,
    select,
    jobSelect,
    categorySelect,
    update,
    set,
    updateWhere,
    insert,
    values,
  };
}

function runWithTx(tx: unknown) {
  mocks.mockTransaction.mockImplementation(
    async (callback: (t: unknown) => unknown) => callback(tx),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assignJobCategory — validation", () => {
  it.each([
    ["job", "not-a-uuid", CATEGORY_ID],
    ["category", JOB_ID, "not-a-uuid"],
  ])("returns NOT_FOUND for an invalid %s id without a transaction", async (
    _label,
    jobId,
    categoryId,
  ) => {
    const result = await assignJobCategory(jobId, categoryId, ACTOR_ID);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });
});

describe("assignJobCategory — guard rails", () => {
  it("returns NOT_FOUND when the job does not exist", async () => {
    const { tx, update, insert } = buildTx();
    runWithTx(tx);

    const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "EXPIRED", "REMOVED"])(
    "returns NOT_DRAFT for a %s job",
    async (status) => {
      const { tx, update, insert } = buildTx({
        jobRows: [{ ...DRAFT_JOB, status }],
      });
      runWithTx(tx);

      const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

      expect(result).toEqual({ ok: false, code: "NOT_DRAFT" });
      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  it("returns ALREADY_ASSIGNED and never overwrites an existing category", async () => {
    const { tx, update, insert } = buildTx({
      jobRows: [{ ...DRAFT_JOB, categoryId: "11111111-1111-4111-8111-111111111111" }],
    });
    runWithTx(tx);

    const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(result).toEqual({ ok: false, code: "ALREADY_ASSIGNED" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns CATEGORY_NOT_FOUND when the category does not exist", async () => {
    const { tx, update, insert } = buildTx({ jobRows: [DRAFT_JOB] });
    runWithTx(tx);

    const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(result).toEqual({ ok: false, code: "CATEGORY_NOT_FOUND" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns CATEGORY_INACTIVE for an inactive category", async () => {
    const { tx, update, insert } = buildTx({
      jobRows: [DRAFT_JOB],
      categoryRows: [{ ...WASH, isActive: false }],
    });
    runWithTx(tx);

    const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(result).toEqual({ ok: false, code: "CATEGORY_INACTIVE" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("locks the job row for the duration of the check-and-write", async () => {
    const { tx, jobSelect } = buildTx({
      jobRows: [DRAFT_JOB],
      categoryRows: [WASH],
    });
    runWithTx(tx);

    await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(jobSelect.limit).toHaveBeenCalledWith(1);
    expect(jobSelect.for).toHaveBeenCalledWith("update");
  });
});

describe("assignJobCategory — success", () => {
  it("assigns the category and writes only categoryId + updatedAt", async () => {
    const { tx, set, values } = buildTx({
      jobRows: [DRAFT_JOB],
      categoryRows: [WASH],
    });
    runWithTx(tx);

    const result = await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(result).toEqual({ ok: true, categoryId: CATEGORY_ID });
    expect(set).toHaveBeenCalledTimes(1);
    const patch = set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).toEqual({
      categoryId: CATEGORY_ID,
      updatedAt: expect.any(Date),
    });
    expect(Object.keys(patch).sort()).toEqual(["categoryId", "updatedAt"]);
    expect(values).toHaveBeenCalledTimes(1);
  });

  it("records an audit event with the previous/next category and lifecycle context", async () => {
    const { tx, values } = buildTx({
      jobRows: [DRAFT_JOB],
      categoryRows: [WASH],
    });
    runWithTx(tx);

    await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    expect(values).toHaveBeenCalledWith({
      actorUserId: ACTOR_ID,
      action: "JOB_CATEGORY_ASSIGNED",
      targetType: "job",
      targetId: JOB_ID,
      metadata: {
        previousCategoryId: null,
        categoryId: CATEGORY_ID,
        categoryName: WASH.name,
        status: "DRAFT",
        verificationStatus: "PENDING",
      },
    });
  });

  it("does not publish, verify, or touch provenance/timestamps beyond updatedAt", async () => {
    const { tx, set } = buildTx({
      jobRows: [{ ...DRAFT_JOB, verificationStatus: "NEEDS_REVIEW" }],
      categoryRows: [WASH],
    });
    runWithTx(tx);

    await assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID);

    const patch = set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("verificationStatus");
    expect(patch).not.toHaveProperty("publishedAt");
    expect(patch).not.toHaveProperty("postedAt");
    expect(patch).not.toHaveProperty("lastVerifiedAt");
    expect(patch).not.toHaveProperty("organizationId");
  });

  it("propagates unexpected database failures", async () => {
    mocks.mockTransaction.mockRejectedValue(
      new Error("connection refused: 10.0.0.1"),
    );

    await expect(
      assignJobCategory(JOB_ID, CATEGORY_ID, ACTOR_ID),
    ).rejects.toThrow("connection refused");
  });
});

describe("listActiveJobCategories", () => {
  it("returns active categories ordered by name", async () => {
    const rows = [
      { id: CATEGORY_ID, name: WASH.name },
      { id: "11111111-1111-4111-8111-111111111111", name: "Finance" },
    ];
    const chain = queryChain(rows);
    mocks.mockSelect.mockReturnValue(chain);

    const result = await listActiveJobCategories();

    expect(result).toEqual(rows);
    expect(mocks.mockSelect).toHaveBeenCalledWith({
      id: expect.anything(),
      name: expect.anything(),
    });
    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);

    const filter = chain.where.mock.calls[0]?.[0] as {
      queryChunks?: unknown[];
    };
    const literals: unknown[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node && typeof node === "object") {
        if ("value" in node) literals.push((node as { value: unknown }).value);
        if ("queryChunks" in node) {
          visit((node as { queryChunks: unknown[] }).queryChunks);
        }
      }
    };
    visit(filter);
    expect(literals).toContain(true);
  });
});
