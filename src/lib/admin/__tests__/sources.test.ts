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
  mockMergedValidation: vi.fn(),
  mockTxSelect: vi.fn(),
  mockTxFor: vi.fn(),
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
      transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          select: (...args: unknown[]) => ({
            from: (...fromArgs: unknown[]) => ({
              where: (...whereArgs: unknown[]) => ({
                limit: (...limitArgs: unknown[]) => ({
                  for: (...forArgs: unknown[]) => {
                    mocks.mockTxFor(...forArgs);
                    return mocks.mockTxSelect(...args, {
                      fromArgs,
                      whereArgs,
                      limitArgs,
                      forArgs,
                    });
                  },
                }),
              }),
            }),
          }),
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
  validateMergedSourceUpdate: (...args: unknown[]) =>
    mocks.mockMergedValidation(...args),
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
const ADMIN_ACTOR = {
  kind: "staff" as const,
  id: ACTOR_ID,
  role: "ADMIN" as const,
};
const MODERATOR_ACTOR = {
  kind: "staff" as const,
  id: ACTOR_ID,
  role: "MODERATOR" as const,
};
const API_KEY_ACTOR = { kind: "api_key" as const };

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

function makeTxMocks(lockedRow?: unknown) {
  const capturedInserts: Record<string, unknown>[] = [];
  const capturedUpdates: Record<string, unknown>[] = [];
  const capturedDeletes: unknown[] = [];
  const events: string[] = [];
  if (lockedRow !== undefined) {
    mocks.mockTxSelect.mockImplementation(async () => {
      events.push("select");
      return lockedRow === null ? [] : [lockedRow];
    });
  }
  mocks.mockInsert.mockImplementation((_table: unknown) => {
    void _table;
    return {
      values: (vals: Record<string, unknown>) => {
        capturedInserts.push(vals);
        events.push("insert");
        return {
          returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
        };
      },
    };
  });
  mocks.mockUpdate.mockImplementation((_table: unknown) => {
    void _table;
    return {
      set: (values: Record<string, unknown>) => {
        capturedUpdates.push(values);
        events.push("update-set");
        return {
          where: vi.fn().mockImplementation(async () => {
            events.push("update-where");
            return undefined;
          }),
        };
      },
    };
  });
  mocks.mockDelete.mockImplementation((_table: unknown) => {
    void _table;
    return {
      where: vi.fn().mockImplementation(async () => {
        capturedDeletes.push(true);
        events.push("delete-where");
        return undefined;
      }),
    };
  });
  return { capturedInserts, capturedUpdates, capturedDeletes, events };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockUsersSelect.mockResolvedValue([]);
  mocks.mockMergedValidation.mockReturnValue({ ok: true });
  mocks.mockTxSelect.mockResolvedValue([]);
  mocks.mockTxFor.mockClear();
  mocks.mockDelete.mockImplementation((_table: unknown) => {
    void _table;
    return {
      where: vi.fn().mockResolvedValue(undefined),
    };
  });
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
      ADMIN_ACTOR,
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
    await createSource({ name: "S", sourceType: "MANUAL" }, ADMIN_ACTOR);
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert).toBeDefined();
    expect(auditInsert?.action).toBe("SOURCE_CREATED");
    expect(auditInsert?.actorUserId).toBe(ACTOR_ID);
    expect(auditInsert?.targetType).toBe("source");
  });

  it("returns DUPLICATE on name conflict", async () => {
    mocks.mockInsert.mockImplementation((_table: unknown) => {
      void _table;
      return {
        values: () => {
          throw new Error("sources_name_unique");
        },
      };
    });
    const result = await createSource({ name: "Dup", sourceType: "MANUAL" }, ADMIN_ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("DUPLICATE");
  });

  it("rejects HIGH trust for a moderator before any write", async () => {
    const result = await createSource(
      { name: "High", sourceType: "WEBSITE", trustLevel: "HIGH" },
      MODERATOR_ACTOR,
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("allows MEDIUM trust for a moderator", async () => {
    const { capturedInserts } = makeTxMocks();
    const result = await createSource(
      { name: "Medium", sourceType: "WEBSITE", trustLevel: "MEDIUM" },
      MODERATOR_ACTOR,
    );
    expect(result.ok).toBe(true);
    expect(capturedInserts[0].trustLevel).toBe("MEDIUM");
  });

  it("rejects HIGH trust and auto-publish for an API-key actor", async () => {
    const high = await createSource(
      { name: "High", sourceType: "WEBSITE", trustLevel: "HIGH" },
      API_KEY_ACTOR,
    );
    expect(high).toEqual({ ok: false, code: "FORBIDDEN" });

    const auto = await createSource(
      { name: "Auto", sourceType: "WEBSITE", autoPublish: true },
      API_KEY_ACTOR,
    );
    expect(auto).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("allows safe API-key source creation with a null audit actor", async () => {
    const { capturedInserts } = makeTxMocks();
    const result = await createSource(
      { name: "Safe API", sourceType: "WEBSITE", trustLevel: "MEDIUM" },
      API_KEY_ACTOR,
    );
    expect(result.ok).toBe(true);
    expect(capturedInserts[0].trustLevel).toBe("MEDIUM");
    const auditInsert = capturedInserts.find((i) => "action" in i);
    expect(auditInsert?.actorUserId).toBeNull();
  });

  it("rejects moderator and API-key Facebook source creation", async () => {
    for (const actor of [MODERATOR_ACTOR, API_KEY_ACTOR]) {
      expect(
        await createSource(
          {
            name: "Facebook Page",
            sourceType: "FACEBOOK",
            baseUrl: "https://www.facebook.com/example",
            facebookPageId: "page-1",
            facebookPageKind: "EXTERNAL_PAGE",
            facebookApprovalState: "APPROVED",
            facebookContentUseState: "AUTHORIZED",
          },
          actor,
        ),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
    }
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("rejects self-asserted Facebook approval metadata on ordinary sources", async () => {
    for (const actor of [MODERATOR_ACTOR, API_KEY_ACTOR]) {
      expect(
        await createSource(
          {
            name: "Approval source",
            sourceType: "WEBSITE",
            facebookApprovalState: "APPROVED",
          },
          actor,
        ),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
    }
  });
});

describe("updateSource", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await updateSource("bad", { name: "X" }, ADMIN_ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    makeTxMocks(null);
    const result = await updateSource(VALID_ID, { name: "X" }, ADMIN_ACTOR);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
  });

  it("returns true when no fields changed", async () => {
    const result = await updateSource(VALID_ID, {}, ADMIN_ACTOR);
    expect(result).toEqual({ ok: true });
    expect(mocks.mockTxSelect).not.toHaveBeenCalled();
  });

  it("locks, re-reads latest source, authorizes against it, and audits changed fields", async () => {
    const current = {
      id: VALID_ID,
      name: "Old",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    };
    const { capturedUpdates, capturedInserts, events } = makeTxMocks(current);
    const result = await updateSource(VALID_ID, { name: "New" }, ADMIN_ACTOR);
    expect(result).toEqual({ ok: true });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(events[0]).toBe("select");
    expect(capturedUpdates[0]).toMatchObject({ name: "New" });
    expect(capturedUpdates[0].updatedAt).toBeInstanceOf(Date);
    const auditInsert = capturedInserts.find((i) => "action" in i) as Record<string, unknown> | undefined;
    expect(auditInsert?.action).toBe("SOURCE_UPDATED");
    expect(auditInsert?.metadata).toEqual({
      fields: ["name"],
      before: { name: "Old" },
      after: { name: "New" },
    });
  });

  it("uses latest locked privilege state and makes no write/audit when denied", async () => {
    const promoted = {
      id: VALID_ID,
      name: "Trusted",
      sourceType: "API",
      baseUrl: "https://trusted.example.com/feed",
      isActive: true,
      trustLevel: "HIGH",
      autoPublish: true,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    };
    const { capturedUpdates, capturedInserts } = makeTxMocks(promoted);
    const result = await updateSource(
      VALID_ID,
      { isActive: false },
      MODERATOR_ACTOR,
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("returns DUPLICATE on name conflict", async () => {
    makeTxMocks({
      id: VALID_ID,
      name: "Old",
      sourceType: "WEBSITE",
      baseUrl: null,
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: null,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    mocks.mockUpdate.mockImplementation(() => {
      throw new Error("sources_name_unique");
    });
    const result = await updateSource(VALID_ID, { name: "Dup" }, ADMIN_ACTOR);
    expect(result).toEqual({ ok: false, code: "DUPLICATE" });
  });

  it("returns VALIDATION when the merged source breaks Facebook invariants", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Facebook Page",
      sourceType: "FACEBOOK",
      baseUrl: "https://www.facebook.com/example",
      isActive: true,
      trustLevel: "HIGH",
      autoPublish: true,
      checkFrequencyMinutes: 60,
      facebookPageId: "page-1",
      facebookPageKind: "OWNED_PAGE",
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    mocks.mockMergedValidation.mockReturnValue({
      ok: false,
      issues: ["Facebook Page ID is required for Facebook sources"],
    });

    const result = await updateSource(
      VALID_ID,
      { facebookPageId: null },
      ADMIN_ACTOR,
    );

    expect(result).toEqual({ ok: false, code: "VALIDATION" });
    expect(mocks.mockMergedValidation).toHaveBeenCalled();
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("rejects a moderator granting HIGH trust", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Source",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    const result = await updateSource(VALID_ID, { trustLevel: "HIGH" }, MODERATOR_ACTOR);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("rejects a moderator enabling auto-publish", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Source",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    const result = await updateSource(VALID_ID, { autoPublish: true }, MODERATOR_ACTOR);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("rejects a moderator changing trust or auto-publish, including downgrades", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Trusted",
      sourceType: "API",
      baseUrl: "https://trusted.example.com/feed",
      isActive: true,
      trustLevel: "HIGH",
      autoPublish: true,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    expect(
      await updateSource(VALID_ID, { trustLevel: "LOW", autoPublish: false }, MODERATOR_ACTOR),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("does not write privileged fields omitted from a partial update", async () => {
    const { capturedUpdates } = makeTxMocks({
      id: VALID_ID,
      name: "Old",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    const result = await updateSource(VALID_ID, { name: "Renamed" }, MODERATOR_ACTOR);
    expect(result).toEqual({ ok: true });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates[0]).not.toHaveProperty("trustLevel");
    expect(capturedUpdates[0]).not.toHaveProperty("autoPublish");
  });

  it("updates allowed ordinary fields without touching existing Facebook metadata", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Old name",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: "page-1",
      facebookPageKind: "EXTERNAL_PAGE",
      facebookApprovalState: "APPROVED",
      facebookContentUseState: "AUTHORIZED",
      facebookAuthorizationNote: "Approved",
    });
    const result = await updateSource(
      VALID_ID,
      { name: "Renamed", checkFrequencyMinutes: 30 },
      MODERATOR_ACTOR,
    );
    expect(result).toEqual({ ok: true });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates[0]).toMatchObject({ name: "Renamed", checkFrequencyMinutes: 30 });
    expect(capturedUpdates[0]).not.toHaveProperty("facebookPageId");
    expect(capturedUpdates[0]).not.toHaveProperty("facebookPageKind");
    expect(capturedUpdates[0]).not.toHaveProperty("facebookApprovalState");
    expect(capturedUpdates[0]).not.toHaveProperty("facebookContentUseState");
    expect(capturedUpdates[0]).not.toHaveProperty("facebookAuthorizationNote");
    const audit = capturedInserts.find((i) => "action" in i) as Record<string, unknown>;
    expect((audit.metadata as { fields: string[] }).fields).toEqual(["name", "checkFrequencyMinutes"]);
  });

  it("rejects redirecting a privileged source without changing privileged fields", async () => {
    const privileged = {
      id: VALID_ID,
      name: "Trusted Feed",
      sourceType: "API",
      baseUrl: "https://trusted.example.com/feed",
      isActive: true,
      trustLevel: "HIGH",
      autoPublish: true,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    };
    for (const patch of [
      { baseUrl: "https://evil.example.com/feed" },
      { sourceType: "FEED" },
      { isActive: false },
    ]) {
      const { capturedUpdates, capturedInserts } = makeTxMocks(privileged);
      expect(await updateSource(VALID_ID, patch, MODERATOR_ACTOR)).toEqual({
        ok: false,
        code: "FORBIDDEN",
      });
      expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
      expect(capturedUpdates).toHaveLength(0);
      expect(capturedInserts).toHaveLength(0);
      vi.clearAllMocks();
      mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
      mocks.mockUsersSelect.mockResolvedValue([]);
      mocks.mockMergedValidation.mockReturnValue({ ok: true });
      mocks.mockTxSelect.mockResolvedValue([]);
    }
  });

  it("rejects moderator Facebook approval changes", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Source",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    });
    expect(
      await updateSource(VALID_ID, { facebookApprovalState: "APPROVED" }, MODERATOR_ACTOR),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });

  it("rejects an API-key actor granting HIGH trust or enabling auto-publish", async () => {
    const ordinary = {
      id: VALID_ID,
      name: "Source",
      sourceType: "WEBSITE",
      baseUrl: "https://example.com",
      isActive: true,
      trustLevel: "MEDIUM",
      autoPublish: false,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    };
    let r = makeTxMocks(ordinary);
    expect(await updateSource(VALID_ID, { trustLevel: "HIGH" }, API_KEY_ACTOR)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(r.capturedUpdates).toHaveLength(0);
    vi.clearAllMocks();
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
    mocks.mockUsersSelect.mockResolvedValue([]);
    mocks.mockMergedValidation.mockReturnValue({ ok: true });
    mocks.mockTxSelect.mockResolvedValue([]);
    r = makeTxMocks(ordinary);
    expect(await updateSource(VALID_ID, { autoPublish: true }, API_KEY_ACTOR)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(r.capturedUpdates).toHaveLength(0);
  });

  it("rejects API-key redirects of privileged sources and downgrades", async () => {
    const privileged = {
      id: VALID_ID,
      name: "Trusted",
      sourceType: "API",
      baseUrl: "https://trusted.example.com/feed",
      isActive: true,
      trustLevel: "HIGH",
      autoPublish: true,
      checkFrequencyMinutes: 60,
      facebookPageId: null,
      facebookPageKind: null,
      facebookApprovalState: "NOT_REQUESTED",
      facebookContentUseState: "NOT_RECORDED",
      facebookAuthorizationNote: null,
    };
    let r = makeTxMocks(privileged);
    expect(
      await updateSource(VALID_ID, { baseUrl: "https://evil.example.com/feed" }, API_KEY_ACTOR),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(r.capturedUpdates).toHaveLength(0);
    vi.clearAllMocks();
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
    mocks.mockUsersSelect.mockResolvedValue([]);
    mocks.mockMergedValidation.mockReturnValue({ ok: true });
    mocks.mockTxSelect.mockResolvedValue([]);
    r = makeTxMocks(privileged);
    expect(
      await updateSource(VALID_ID, { trustLevel: "LOW", autoPublish: false }, API_KEY_ACTOR),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(r.capturedUpdates).toHaveLength(0);
  });
});

describe("deleteSource", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await deleteSource("bad", ADMIN_ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    makeTxMocks(null);
    const result = await deleteSource(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
  });

  it("deletes and writes audit", async () => {
    const { capturedInserts, capturedDeletes } = makeTxMocks({
      id: VALID_ID, name: "Source", sourceType: "WEBSITE", trustLevel: "MEDIUM", autoPublish: false,
    });
    const result = await deleteSource(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: true });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedDeletes.length).toBeGreaterThan(0);
    const auditInsert = capturedInserts.find((i) => "action" in i) as Record<string, unknown>;
    expect(auditInsert.action).toBe("SOURCE_DELETED");
  });

  it("returns FK_VIOLATION on foreign key error", async () => {
    makeTxMocks({ id: VALID_ID, name: "Source", sourceType: "WEBSITE", trustLevel: "MEDIUM", autoPublish: false });
    mocks.mockDelete.mockImplementation(() => ({
      where: () => { throw new Error("foreign key constraint"); },
    }));
    const result = await deleteSource(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: false, code: "FK_VIOLATION" });
  });

  it("rejects moderator deletion of privileged sources", async () => {
    const { capturedDeletes, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Trusted",
      sourceType: "API",
      trustLevel: "HIGH",
      autoPublish: true,
    });
    const result = await deleteSource(VALID_ID, MODERATOR_ACTOR);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedDeletes).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
  });
});

describe("toggleSourceActive", () => {
  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await toggleSourceActive("bad", ADMIN_ACTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for nonexistent source", async () => {
    makeTxMocks(null);
    const result = await toggleSourceActive(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
  });

  it("toggles active -> inactive", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID, name: "Source", sourceType: "WEBSITE", isActive: true, trustLevel: "MEDIUM", autoPublish: false,
    });
    const result = await toggleSourceActive(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: true, isActive: false });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates[0].isActive).toBe(false);
    const auditInsert = capturedInserts.find((i) => "action" in i) as Record<string, unknown>;
    expect(auditInsert.action).toBe("SOURCE_DEACTIVATED");
  });

  it("toggles inactive -> active", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID, name: "Source", sourceType: "WEBSITE", isActive: false, trustLevel: "MEDIUM", autoPublish: false,
    });
    const result = await toggleSourceActive(VALID_ID, ADMIN_ACTOR);
    expect(result).toEqual({ ok: true, isActive: true });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates[0].isActive).toBe(true);
    const auditInsert = capturedInserts.find((i) => "action" in i) as Record<string, unknown>;
    expect(auditInsert.action).toBe("SOURCE_ACTIVATED");
  });

  it("rejects moderator activation of a privileged source", async () => {
    const { capturedUpdates, capturedInserts } = makeTxMocks({
      id: VALID_ID,
      name: "Trusted",
      sourceType: "API",
      isActive: false,
      trustLevel: "HIGH",
      autoPublish: true,
    });
    const result = await toggleSourceActive(VALID_ID, MODERATOR_ACTOR);
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTxFor).toHaveBeenCalledWith("update");
    expect(capturedUpdates).toHaveLength(0);
    expect(capturedInserts).toHaveLength(0);
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
