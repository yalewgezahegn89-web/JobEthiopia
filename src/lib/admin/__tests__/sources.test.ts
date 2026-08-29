import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSourcesFindFirst: vi.fn(),
  mockSourcesFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockUsersSelect: vi.fn(),
  mockCountRows: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        sources: {
          findFirst: (...args: unknown[]) => mocks.mockSourcesFindFirst(...args),
          findMany: (...args: unknown[]) => mocks.mockSourcesFindMany(...args),
        },
        auditLog: {
          findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
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
        const tx = {
          insert: mocks.mockInsert,
          update: mocks.mockUpdate,
          delete: mocks.mockDelete,
        };
        return fn(tx);
      },
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
    },
  };
});

vi.mock("@/lib/validations", () => ({
  createSourceSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
  updateSourceSchema: {
    safeParse: (input: unknown) => ({ success: true, data: input }),
  },
}));

import {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
  toggleSourceActive,
  getSourceAuditHistory,
  isValidUuid,
} from "@/lib/admin/sources";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const SOURCE_ROW = {
  id: VALID_ID,
  name: "Test Source",
  sourceType: "WEBSITE" as const,
  baseUrl: "https://example.com",
  isActive: true,
  trustLevel: "MEDIUM" as const,
  lastSuccessfulCheck: null,
  lastAttemptedCheck: null,
  lastError: null,
  checkFrequencyMinutes: 60,
  consecutiveFailures: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeTxMocks() {
  const capturedInserts: Record<string, unknown>[] = [];
  const capturedUpdates: Record<string, unknown>[] = [];
  const capturedDeletes: unknown[] = [];
  mocks.mockInsert.mockImplementation((_table: unknown) => ({
    values: (vals: Record<string, unknown>) => {
      capturedInserts.push(vals);
      return {
        returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
      };
    },
  }));
  mocks.mockUpdate.mockImplementation((_table: unknown) => ({
    set: (values: Record<string, unknown>) => {
      capturedUpdates.push(values);
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    },
  }));
  mocks.mockDelete.mockImplementation((_table: unknown) => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
  return { capturedInserts, capturedUpdates, capturedDeletes };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockUsersSelect.mockResolvedValue([]);
  mocks.mockDelete.mockImplementation((_table: unknown) => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
});

describe("isValidUuid", () => {
  it("accepts valid UUID", () => {
    expect(isValidUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
  });
});

describe("listSources", () => {
  it("returns paginated sources", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([
      { ...SOURCE_ROW, id: VALID_ID },
    ]);
    const result = await listSources({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
    expect(result.total).toBe(0);
  });

  it("applies isActive filter", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([]);
    await listSources({ isActive: true });
    expect(mocks.mockSourcesFindMany).toHaveBeenCalled();
  });

  it("applies sourceType filter", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([]);
    await listSources({ sourceType: "API" });
    expect(mocks.mockSourcesFindMany).toHaveBeenCalled();
  });

  it("sanitizes page/limit", async () => {
    mocks.mockSourcesFindMany.mockResolvedValue([]);
    await listSources({ page: -1, limit: 200 });
    expect(mocks.mockSourcesFindMany).toHaveBeenCalled();
  });
});

describe("getSource", () => {
  it("returns source for valid ID", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(SOURCE_ROW);
    const result = await getSource(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
  });

  it("returns null for invalid UUID", async () => {
    const result = await getSource("not-a-uuid");
    expect(result).toBeNull();
    expect(mocks.mockSourcesFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when not found", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const result = await getSource(VALID_ID);
    expect(result).toBeNull();
  });
});

describe("createSource", () => {
  it("inserts a source with correct fields", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    const result = await createSource(
      { name: "New Source", sourceType: "WEBSITE", baseUrl: "https://example.com", trustLevel: "HIGH" },
      ACTOR_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe(VALID_ID);
    expect(capturedInserts[0].name).toBe("New Source");
    expect(capturedInserts[0].sourceType).toBe("WEBSITE");
    expect(capturedInserts[0].baseUrl).toBe("https://example.com");
    expect(capturedInserts[0].trustLevel).toBe("HIGH");
    expect(capturedInserts[0].isActive).toBe(true);
  });

  it("inserts audit event SOURCE_CREATED", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const { capturedInserts } = makeTxMocks();
    await createSource({ name: "S", sourceType: "MANUAL" }, ACTOR_ID);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert).toBeDefined();
    expect(auditInsert?.action).toBe("SOURCE_CREATED");
    expect(auditInsert?.actorUserId).toBe(ACTOR_ID);
    expect(auditInsert?.targetType).toBe("source");
  });

  it("returns DUPLICATE on name conflict", async () => {
    mocks.mockInsert.mockImplementation((_table: unknown) => ({
      values: () => {
        throw new Error("sources_name_unique");
      },
    }));
    const result = await createSource({ name: "Dup", sourceType: "MANUAL" }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUPLICATE");
  });
});

describe("updateSource", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await updateSource("bad", { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const result = await updateSource(VALID_ID, { name: "X" }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns true when no fields changed", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID });
    const result = await updateSource(VALID_ID, {}, ACTOR_ID);
    expect(result.ok).toBe(true);
  });

  it("updates fields and writes audit", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID, name: "Old" });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await updateSource(VALID_ID, { name: "New" }, ACTOR_ID);
    expect(result.ok).toBe(true);
    expect(capturedUpdates[0].name).toBe("New");
    expect(capturedUpdates[0].updatedAt).toBeInstanceOf(Date);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert?.action).toBe("SOURCE_UPDATED");
  });

  it("returns DUPLICATE on name conflict", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID });
    mocks.mockUpdate.mockImplementation(() => {
      throw new Error("sources_name_unique");
    });
    const result = await updateSource(VALID_ID, { name: "Dup" }, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUPLICATE");
  });
});

describe("deleteSource", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await deleteSource("bad", ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const result = await deleteSource(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("deletes and writes audit", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID, name: "Source" });
    const { capturedInserts } = makeTxMocks();
    const result = await deleteSource(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert?.action).toBe("SOURCE_DELETED");
  });

  it("returns FK_VIOLATION on foreign key error", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID, name: "Source" });
    mocks.mockDelete.mockImplementation(() => ({
      where: () => { throw new Error("foreign key constraint"); },
    }));
    const result = await deleteSource(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FK_VIOLATION");
  });
});

describe("toggleSourceActive", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await toggleSourceActive("bad", ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue(null);
    const result = await toggleSourceActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("toggles active -> inactive", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID, isActive: true });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await toggleSourceActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(false);
    expect(capturedUpdates[0].isActive).toBe(false);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert?.action).toBe("SOURCE_DEACTIVATED");
  });

  it("toggles inactive -> active", async () => {
    mocks.mockSourcesFindFirst.mockResolvedValue({ id: VALID_ID, isActive: false });
    const { capturedUpdates, capturedInserts } = makeTxMocks();
    const result = await toggleSourceActive(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isActive).toBe(true);
    expect(capturedUpdates[0].isActive).toBe(true);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert?.action).toBe("SOURCE_ACTIVATED");
  });
});

describe("getSourceAuditHistory", () => {
  it("returns empty for invalid UUID", async () => {
    const result = await getSourceAuditHistory("bad");
    expect(result).toEqual([]);
  });

  it("returns empty when no events", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    const result = await getSourceAuditHistory(VALID_ID);
    expect(result).toEqual([]);
  });

  it("maps audit entries with actor emails", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e1",
        action: "SOURCE_CREATED",
        targetType: "source",
        targetId: VALID_ID,
        metadata: { name: "New Source" },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorUserId: ACTOR_ID,
      },
    ]);
    mocks.mockUsersSelect.mockResolvedValue([{ id: ACTOR_ID, email: "admin@test.com" }]);

    const result = await getSourceAuditHistory(VALID_ID);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("SOURCE_CREATED");
    expect(result[0].actorEmail).toBe("admin@test.com");
  });

  it("handles null actorUserId", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e1",
        action: "SOURCE_CREATED",
        targetType: "source",
        targetId: VALID_ID,
        metadata: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorUserId: null,
      },
    ]);
    mocks.mockUsersSelect.mockResolvedValue([]);

    const result = await getSourceAuditHistory(VALID_ID);
    expect(result).toHaveLength(1);
    expect(result[0].actorEmail).toBeNull();
  });
});
