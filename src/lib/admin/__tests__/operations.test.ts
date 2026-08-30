import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockAuditFindMany: vi.fn(),
  mockSourcesFindMany: vi.fn(),
  mockSourceSelect: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      auditLog: {
        findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
      },
      sources: {
        findMany: (...args: unknown[]) => mocks.mockSourcesFindMany(...args),
      },
    },
    select: (fields: Record<string, unknown>) => {
      if (fields && "id" in fields && "name" in fields) {
        return {
          from: () => ({
            where: () => mocks.mockSourceSelect(),
          }),
        };
      }
      return {
        from: () => ({
          where: () => mocks.mockSourceSelect(),
        }),
      };
    },
  },
}));

import { getOperationsSummary } from "@/lib/admin/operations";

const NOW = new Date("2026-03-15T10:00:00.000Z");
const EARLIER = new Date("2026-03-14T09:00:00.000Z");

const MAINT_ROW = {
  metadata: {
    expiredJobs: 5,
    sourcesChecked: 10,
    sourcesSucceeded: 8,
    sourcesFailed: 1,
    sourcesSkipped: 1,
    durationMs: 1234,
  },
  createdAt: NOW,
};

const INGEST_ROW = {
  metadata: {
    source: "api_key",
    total: 20,
    created: 10,
    updated: 3,
    duplicate: 5,
    linked: 1,
    possibleDuplicate: 1,
    failed: 0,
    durationMs: 567,
  },
  createdAt: NOW,
  targetId: "src-111",
};

const FAILING_SOURCE = {
  id: "src-111",
  name: "Test Source",
  lastError: "HTTP 500",
  consecutiveFailures: 3,
  lastAttemptedCheck: NOW,
  lastSuccessfulCheck: EARLIER,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockAuditFindMany.mockResolvedValue([]);
  mocks.mockSourcesFindMany.mockResolvedValue([]);
  mocks.mockSourceSelect.mockResolvedValue([]);
});

describe("getOperationsSummary", () => {
  it("returns latest maintenance run", async () => {
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([MAINT_ROW])
      .mockResolvedValueOnce([]);

    const result = await getOperationsSummary();

    expect(result.latestMaintenance).not.toBeNull();
    expect(result.latestMaintenance!.expiredJobs).toBe(5);
    expect(result.latestMaintenance!.sourcesChecked).toBe(10);
    expect(result.latestMaintenance!.durationMs).toBe(1234);
  });

  it("returns recent maintenance bounded to 20", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      metadata: { expiredJobs: i, sourcesChecked: 0, sourcesSucceeded: 0, sourcesFailed: 0, sourcesSkipped: 0 },
      createdAt: new Date(Date.now() - i * 60000),
    }));
    mocks.mockAuditFindMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([]);

    const result = await getOperationsSummary();

    expect(result.recentMaintenance).toHaveLength(20);
  });

  it("returns latest ingestion batch", async () => {
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([INGEST_ROW]);
    mocks.mockSourceSelect.mockResolvedValue([
      { id: "src-111", name: "Test Source" },
    ]);

    const result = await getOperationsSummary();

    expect(result.latestIngestion).not.toBeNull();
    expect(result.latestIngestion!.created).toBe(10);
    expect(result.latestIngestion!.sourceName).toBe("Test Source");
    expect(result.latestIngestion!.durationMs).toBe(567);
  });

  it("returns recent ingestion bounded to 20", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      metadata: { created: i, updated: 0, duplicate: 0, failed: 0 },
      createdAt: new Date(Date.now() - i * 60000),
      targetId: "src-111",
    }));
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(rows);

    const result = await getOperationsSummary();

    expect(result.recentIngestion).toHaveLength(20);
  });

  it("returns failing sources", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([FAILING_SOURCE]);

    const result = await getOperationsSummary();

    expect(result.failingSources).toHaveLength(1);
    expect(result.failingSources[0].consecutiveFailures).toBe(3);
    expect(result.failingSources[0].lastError).toBe("HTTP 500");
  });

  it("returns failing sources ordered by consecutiveFailures DESC", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([
      { ...FAILING_SOURCE, id: "b", consecutiveFailures: 5 },
      { ...FAILING_SOURCE, id: "a", consecutiveFailures: 1 },
    ]);

    const result = await getOperationsSummary();

    expect(result.failingSources[0].consecutiveFailures).toBe(5);
    expect(result.failingSources[1].consecutiveFailures).toBe(1);
  });

  it("resolves source names for ingestion events", async () => {
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([INGEST_ROW]);
    mocks.mockSourceSelect.mockResolvedValue([
      { id: "src-111", name: "Resolved Source" },
    ]);

    const result = await getOperationsSummary();

    expect(result.latestIngestion!.sourceName).toBe("Resolved Source");
  });

  it("shows null sourceName for unknown source", async () => {
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([INGEST_ROW]);
    mocks.mockSourceSelect.mockResolvedValue([]);

    const result = await getOperationsSummary();

    expect(result.latestIngestion!.sourceName).toBeNull();
  });

  it("returns empty state when no data exists", async () => {
    const result = await getOperationsSummary();

    expect(result.latestMaintenance).toBeNull();
    expect(result.latestIngestion).toBeNull();
    expect(result.failingSources).toHaveLength(0);
    expect(result.recentMaintenance).toHaveLength(0);
    expect(result.recentIngestion).toHaveLength(0);
  });

  it("queries audit_log with correct action filters", async () => {
    await getOperationsSummary();

    const calls = mocks.mockAuditFindMany.mock.calls;
    expect(calls).toHaveLength(2);
    const maintenanceWhere = calls[0][0].where;
    const ingestionWhere = calls[1][0].where;
    expect(maintenanceWhere).toBeDefined();
    expect(ingestionWhere).toBeDefined();
  });

  it("queries failing sources with consecutiveFailures > 0 or lastError", async () => {
    await getOperationsSummary();

    expect(mocks.mockSourcesFindMany).toHaveBeenCalledTimes(1);
    const where = mocks.mockSourcesFindMany.mock.calls[0][0].where;
    expect(where).toBeDefined();
  });

  it("does not include sensitive fields in output", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([
      { ...FAILING_SOURCE, lastError: "Connection refused" },
    ]);

    const result = await getOperationsSummary();

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("secret");
  });

  it("handles maintenance metadata with missing durationMs", async () => {
    const row = {
      metadata: {
        expiredJobs: 2,
        sourcesChecked: 5,
        sourcesSucceeded: 4,
        sourcesFailed: 1,
        sourcesSkipped: 0,
      },
      createdAt: NOW,
    };
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([]);

    const result = await getOperationsSummary();

    expect(result.latestMaintenance!.durationMs).toBeNull();
  });

  it("handles ingestion metadata with missing optional fields", async () => {
    const row = {
      metadata: {
        source: "api_key",
        created: 1,
        updated: 0,
        duplicate: 0,
        failed: 0,
      },
      createdAt: NOW,
      targetId: "src-aaa",
    };
    mocks.mockAuditFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    mocks.mockSourceSelect.mockResolvedValue([]);

    const result = await getOperationsSummary();

    expect(result.latestIngestion!.total).toBeNull();
    expect(result.latestIngestion!.linked).toBeNull();
    expect(result.latestIngestion!.possibleDuplicate).toBeNull();
  });
});
