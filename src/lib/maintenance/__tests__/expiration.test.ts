import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockSelect(...args),
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/db/schema/jobs", () => ({
  jobs: {
    id: "jobs_id_column",
    status: "jobs_status_column",
    deadline: "jobs_deadline_column",
    updatedAt: "jobs_updatedAt_column",
  },
}));

vi.mock("@/db/schema/auditLog", () => ({
  auditLog: {
    actorUserId: "auditLog_actorUserId_column",
    action: "auditLog_action_column",
    targetType: "auditLog_targetType_column",
    targetId: "auditLog_targetId_column",
    metadata: "auditLog_metadata_column",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq_filter"),
  and: vi.fn((...args: unknown[]) => args),
  lt: vi.fn(() => "lt_filter"),
  sql: vi.fn(() => "sql_filter"),
}));

import { expireDueJobs } from "../expiration";

function makeJobRow(id: string, deadline: Date | null) {
  return { id, deadline };
}

function mockSelectReturn(rows: unknown[]) {
  mocks.mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function makeTxMock(returningResult: unknown[]) {
  const insertValues: Record<string, unknown>[] = [];
  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(returningResult),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        insertValues.push(vals);
        return Promise.resolve([]);
      }),
    }),
  };
  return { tx, insertValues };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expireDueJobs", () => {
  describe("eligibility", () => {
    it("expires a job with past deadline and PUBLISHED status", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2026-01-01T00:00:00Z"))]);
      const { tx } = makeTxMock([{ id: jobId }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(1);
    });

    it("does NOT expire job with deadline exactly equal to now", async () => {
      const now = new Date("2026-06-01T00:00:00Z");
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2026-06-01T00:00:00Z"))]);
      const { tx } = makeTxMock([]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(now);
      expect(result.expired).toBe(0);
    });

    it("does NOT expire job with future deadline", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2027-01-01T00:00:00Z"))]);
      const { tx } = makeTxMock([]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });

    it("does NOT expire job with NULL deadline", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, null)]);
      const { tx } = makeTxMock([]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });

    it("returns zero when no eligible jobs exist", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
      expect(mocks.mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe("already terminal", () => {
    it("does NOT touch EXPIRED jobs (select filters them out)", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });

    it("does NOT touch REMOVED jobs (select filters them out)", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });

    it("does NOT touch DRAFT jobs (select filters them out)", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });

    it("does NOT touch PENDING_REVIEW jobs (select filters them out)", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });
  });

  describe("deterministic time", () => {
    it("uses injected now for consistent results", async () => {
      const now = new Date("2026-03-15T12:00:00Z");
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2026-03-15T11:59:59Z"))]);
      const { tx } = makeTxMock([{ id: jobId }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(now);
      expect(result.expired).toBe(1);
    });
  });

  describe("idempotency", () => {
    it("second run expires zero when all eligible jobs already expired", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });
  });

  describe("audit logging", () => {
    it("creates JOB_AUTO_EXPIRED audit event for each expired job", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      const deadline = new Date("2026-01-01T00:00:00Z");
      mockSelectReturn([makeJobRow(jobId, deadline)]);
      const { tx, insertValues } = makeTxMock([{ id: jobId }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      await expireDueJobs(new Date("2026-06-01T00:00:00Z"));

      expect(insertValues.length).toBe(1);
      expect(insertValues[0].action).toBe("JOB_AUTO_EXPIRED");
      expect(insertValues[0].actorUserId).toBeNull();
      expect(insertValues[0].targetType).toBe("job");
      expect(insertValues[0].targetId).toBe(jobId);
    });

    it("audit metadata contains safe lifecycle information", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      const deadline = new Date("2026-01-01T00:00:00Z");
      mockSelectReturn([makeJobRow(jobId, deadline)]);
      const { tx, insertValues } = makeTxMock([{ id: jobId }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      await expireDueJobs(new Date("2026-06-01T00:00:00Z"));

      expect(insertValues[0].metadata).toEqual({
        fromStatus: "PUBLISHED",
        toStatus: "EXPIRED",
        deadline: "2026-01-01T00:00:00.000Z",
      });
    });

    it("actorUserId is null for system actions", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2026-01-01T00:00:00Z"))]);
      const { tx, insertValues } = makeTxMock([{ id: jobId }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(insertValues[0].actorUserId).toBeNull();
    });

    it("no audit event is created when update returns no rows", async () => {
      const jobId = "11111111-1111-4111-8111-111111111111";
      mockSelectReturn([makeJobRow(jobId, new Date("2026-01-01T00:00:00Z"))]);
      const { tx, insertValues } = makeTxMock([]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
      expect(insertValues.length).toBe(0);
    });
  });

  describe("concurrency", () => {
    it("safe for concurrent execution — second run finds nothing", async () => {
      mockSelectReturn([]);
      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(0);
    });
  });

  describe("summary count", () => {
    it("returns correct count for multiple expired jobs", async () => {
      const jobRows = [
        makeJobRow("11111111-1111-4111-8111-111111111111", new Date("2026-01-01T00:00:00Z")),
        makeJobRow("22222222-2222-4222-8222-222222222222", new Date("2026-02-01T00:00:00Z")),
        makeJobRow("33333333-3333-4333-8333-333333333333", new Date("2026-03-01T00:00:00Z")),
      ];
      mockSelectReturn(jobRows);
      const { tx } = makeTxMock([{ id: "x" }]);
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => fn(tx),
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(3);
    });
  });

  describe("partial failure", () => {
    it("continues processing when one job transaction fails", async () => {
      const jobRows = [
        makeJobRow("11111111-1111-4111-8111-111111111111", new Date("2026-01-01T00:00:00Z")),
        makeJobRow("22222222-2222-4222-8222-222222222222", new Date("2026-02-01T00:00:00Z")),
      ];
      mockSelectReturn(jobRows);

      let callCount = 0;
      mocks.mockTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<void>) => {
          callCount += 1;
          if (callCount === 1) {
            throw new Error("DB error");
          }
          const { tx } = makeTxMock([{ id: "22222222-2222-4222-8222-222222222222" }]);
          return fn(tx);
        },
      );

      const result = await expireDueJobs(new Date("2026-06-01T00:00:00Z"));
      expect(result.expired).toBe(1);
    });
  });
});
