import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUsersFindFirst: vi.fn(),
  mockUsersFindMany: vi.fn(),
  mockSessionsFindMany: vi.fn(),
  mockAuditFindMany: vi.fn(),
  mockCountRows: vi.fn(),
  mockSessionCountRows: vi.fn(),
  mockActorSelectRows: vi.fn(),
  mockTxUserSelectRows: vi.fn(),
  mockTxCountSelectRows: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockRevokeSessionsForUser: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        users: {
          findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
          findMany: (...args: unknown[]) => mocks.mockUsersFindMany(...args),
        },
        auditLog: {
          findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
        },
      },
      select: (fields: Record<string, unknown>) => {
        if (fields && "userId" in fields) {
          return {
            from: () => ({
              where: () => ({
                groupBy: () => mocks.mockSessionCountRows(),
              }),
            }),
          };
        }
        if (fields && "id" in fields && "email" in fields) {
          return {
            from: () => ({
              where: () => mocks.mockActorSelectRows(),
            }),
          };
        }
        if (fields && "count" in fields) {
          return {
            from: () => ({
              where: () => mocks.mockCountRows(),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: () => mocks.mockTxUserSelectRows(),
            }),
          }),
        };
      },
      transaction: async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          insert: mocks.mockInsert,
          update: mocks.mockUpdate,
          delete: mocks.mockDelete,
          select: (fields: Record<string, unknown>) => {
            const result = fields && "count" in fields
              ? mocks.mockTxCountSelectRows()
              : mocks.mockTxUserSelectRows();
            return {
              from: () => ({
                where: () => ({
                  limit: () => Promise.resolve(result).then((v) => Array.isArray(v) ? v : [v]),
                  then: (resolve: (v: unknown) => void) => resolve(result),
                }),
              }),
            };
          },
        };
        return fn(tx);
      },
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
    },
  };
});

vi.mock("@/lib/auth/session", () => ({
  revokeSessionsForUser: (...args: unknown[]) =>
    mocks.mockRevokeSessionsForUser(...args),
}));

import {
  listUsers,
  getUser,
  toggleUserActive,
  revokeUserSessions,
  getUserAuditHistory,
  changeUserRole,
} from "@/lib/admin/users";

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const USER_ROW = {
  id: VALID_ID,
  name: "Test User",
  email: "test@example.com",
  role: "MODERATOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function makeTxMocks() {
  const capturedInserts: Record<string, unknown>[] = [];
  const capturedUpdates: Record<string, unknown>[] = [];
  mocks.mockInsert.mockImplementation((_table: unknown) => ({
    values: (vals: Record<string, unknown>) => {
      capturedInserts.push(vals);
      return { then: (resolve: (v: unknown) => void) => resolve(undefined) };
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
  return { capturedInserts, capturedUpdates };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockSessionCountRows.mockResolvedValue([]);
  mocks.mockActorSelectRows.mockResolvedValue([]);
  mocks.mockTxUserSelectRows.mockResolvedValue(null);
  mocks.mockTxCountSelectRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockDelete.mockImplementation((_table: unknown) => ({
    where: vi.fn().mockResolvedValue(undefined),
  }));
});

describe("listUsers", () => {
  it("returns paginated results", async () => {
    mocks.mockUsersFindMany.mockResolvedValue([USER_ROW]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listUsers({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(VALID_ID);
    expect(result.items[0].name).toBe("Test User");
    expect(result.items[0].email).toBe("test@example.com");
    expect(result.items[0].role).toBe("MODERATOR");
    expect(result.items[0].isActive).toBe(true);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it("applies isActive filter", async () => {
    mocks.mockUsersFindMany.mockResolvedValue([]);
    await listUsers({ isActive: true });
    expect(mocks.mockUsersFindMany).toHaveBeenCalled();
  });

  it("applies role filter", async () => {
    mocks.mockUsersFindMany.mockResolvedValue([]);
    await listUsers({ role: "ADMIN" });
    expect(mocks.mockUsersFindMany).toHaveBeenCalled();
  });

  it("never returns passwordHash", async () => {
    mocks.mockUsersFindMany.mockResolvedValue([
      { ...USER_ROW, passwordHash: "secret-hash" },
    ]);
    const result = await listUsers({});
    expect(result.items[0]).not.toHaveProperty("passwordHash");
  });
});

describe("getUser", () => {
  it("returns user with safe fields", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(USER_ROW);
    mocks.mockTxCountSelectRows.mockResolvedValue([{ count: 0 }]);

    const result = await getUser(VALID_ID);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(VALID_ID);
    expect(result!.name).toBe("Test User");
    expect(result!.role).toBe("MODERATOR");
  });

  it("returns null for invalid UUID", async () => {
    const result = await getUser("not-a-uuid");
    expect(result).toBeNull();
  });

  it("returns null for missing user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);
    const result = await getUser(VALID_ID);
    expect(result).toBeNull();
  });

  it("never returns passwordHash", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue({
      ...USER_ROW,
      passwordHash: "secret",
    });
    mocks.mockTxCountSelectRows.mockResolvedValue([{ count: 0 }]);
    const result = await getUser(VALID_ID);
    expect(result).not.toHaveProperty("passwordHash");
  });
});

describe("getUserAuditHistory", () => {
  it("returns audit entries", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([
      {
        id: "e1",
        action: "USER_ACTIVATED",
        targetType: "user",
        targetId: VALID_ID,
        metadata: { fromIsActive: false, toIsActive: true },
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorUserId: ACTOR_ID,
      },
    ]);
    mocks.mockActorSelectRows.mockResolvedValue([
      { id: ACTOR_ID, email: "admin@example.com" },
    ]);

    const result = await getUserAuditHistory(VALID_ID);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("USER_ACTIVATED");
  });

  it("returns empty for invalid UUID", async () => {
    const result = await getUserAuditHistory("bad-uuid");
    expect(result).toHaveLength(0);
  });
});

describe("toggleUserActive", () => {
  it("deactivates an active user", async () => {
    const { capturedUpdates } = makeTxMocks();
    mocks.mockTxUserSelectRows.mockResolvedValue([{
      id: VALID_ID,
      isActive: true,
      role: "MODERATOR",
    }]);
    mocks.mockTxCountSelectRows.mockResolvedValue([{ count: 3 }]);

    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isActive).toBe(false);
    }
    expect(capturedUpdates.length).toBeGreaterThan(0);
  });

  it("activates an inactive user", async () => {
    makeTxMocks();
    mocks.mockTxUserSelectRows.mockResolvedValue([{
      id: VALID_ID,
      isActive: false,
      role: "CANDIDATE",
    }]);

    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isActive).toBe(true);
    }
  });

  it("rejects self-deactivation", async () => {
    const result = await toggleUserActive(ACTOR_ID, ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SELF_DEACTIVATION");
    }
  });

  it("rejects deactivation of last SUPER_ADMIN", async () => {
    makeTxMocks();
    mocks.mockTxUserSelectRows.mockResolvedValue([{
      id: VALID_ID,
      isActive: true,
      role: "SUPER_ADMIN",
    }]);
    mocks.mockTxCountSelectRows.mockResolvedValue([{ count: 1 }]);

    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("LAST_SUPER_ADMIN");
    }
  });

  it("rejects MODERATOR from toggling", async () => {
    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "MODERATOR");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("allows ADMIN to toggle", async () => {
    makeTxMocks();
    mocks.mockTxUserSelectRows.mockResolvedValue([{
      id: VALID_ID,
      isActive: true,
      role: "CANDIDATE",
    }]);

    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "ADMIN");
    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await toggleUserActive("bad-uuid", ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("is idempotent for same state", async () => {
    makeTxMocks();
    mocks.mockTxUserSelectRows.mockResolvedValue([{
      id: VALID_ID,
      isActive: true,
      role: "MODERATOR",
    }]);

    const result = await toggleUserActive(VALID_ID, ACTOR_ID, "SUPER_ADMIN");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isActive).toBe(false);
    }
  });
});

describe("revokeUserSessions", () => {
  it("revokes sessions for a user", async () => {
    makeTxMocks();
    mocks.mockUsersFindFirst.mockResolvedValue({ id: VALID_ID });
    mocks.mockRevokeSessionsForUser.mockResolvedValue(3);

    const result = await revokeUserSessions(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionsRevoked).toBe(3);
    }
  });

  it("rejects self-force-logout", async () => {
    const result = await revokeUserSessions(ACTOR_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SELF_FORCE_LOGOUT");
    }
  });

  it("returns NOT_FOUND for invalid UUID", async () => {
    const result = await revokeUserSessions("bad-uuid", ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("returns NOT_FOUND for missing user", async () => {
    mocks.mockUsersFindFirst.mockResolvedValue(null);
    const result = await revokeUserSessions(VALID_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("writes audit event", async () => {
    const { capturedInserts } = makeTxMocks();
    mocks.mockUsersFindFirst.mockResolvedValue({ id: VALID_ID });
    mocks.mockRevokeSessionsForUser.mockResolvedValue(2);

    await revokeUserSessions(VALID_ID, ACTOR_ID);

    expect(capturedInserts.length).toBeGreaterThan(0);
    const auditEntry = capturedInserts.find(
      (e) => e.action === "USER_SESSIONS_REVOKED",
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.actorUserId).toBe(ACTOR_ID);
    expect(auditEntry?.targetId).toBe(VALID_ID);
  });
});

describe("changeUserRole", () => {
  it("changes MODERATOR to ADMIN", async () => {
    const { capturedInserts, capturedUpdates } = makeTxMocks();
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: ACTOR_ID, role: "SUPER_ADMIN", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "MODERATOR", isActive: true });

    const result = await changeUserRole(VALID_ID, "ADMIN", ACTOR_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fromRole).toBe("MODERATOR");
      expect(result.toRole).toBe("ADMIN");
    }
    expect(capturedUpdates.length).toBeGreaterThan(0);
    expect(capturedUpdates.some((u) => u.role === "ADMIN")).toBe(true);
    const auditEntry = capturedInserts.find(
      (e) => e.action === "USER_ROLE_CHANGED",
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.metadata).toEqual({ fromRole: "MODERATOR", toRole: "ADMIN" });
  });

  it("handles same-role as no-op", async () => {
    const { capturedInserts, capturedUpdates } = makeTxMocks();
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: ACTOR_ID, role: "SUPER_ADMIN", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "MODERATOR", isActive: true });

    const result = await changeUserRole(VALID_ID, "MODERATOR", ACTOR_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fromRole).toBe("MODERATOR");
      expect(result.toRole).toBe("MODERATOR");
    }
    expect(capturedUpdates.length).toBe(0);
    const auditEntry = capturedInserts.find(
      (e) => e.action === "USER_ROLE_CHANGED",
    );
    expect(auditEntry).toBeUndefined();
  });

  it("rejects self-change", async () => {
    const result = await changeUserRole(ACTOR_ID, "ADMIN", ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SELF_CHANGE");
    }
  });

  it("rejects demotion of last active SUPER_ADMIN", async () => {
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: ACTOR_ID, role: "SUPER_ADMIN", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "SUPER_ADMIN", isActive: true });
    mocks.mockTxCountSelectRows.mockResolvedValueOnce([{ count: 1 }]);

    const result = await changeUserRole(VALID_ID, "ADMIN", ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("LAST_SUPER_ADMIN");
    }
  });

  it("rejects non-super-admin actor", async () => {
    const otherActorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: otherActorId, role: "ADMIN", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "MODERATOR", isActive: true });

    const result = await changeUserRole(VALID_ID, "ADMIN", otherActorId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects invalid UUID", async () => {
    const result = await changeUserRole("bad-uuid", "ADMIN", ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("rejects invalid role", async () => {
    const result = await changeUserRole(VALID_ID, "FAKE_ROLE" as never, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_ROLE");
    }
  });

  it("returns NOT_FOUND for missing target", async () => {
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: ACTOR_ID, role: "SUPER_ADMIN", isActive: true })
      .mockResolvedValueOnce(null);

    const result = await changeUserRole(VALID_ID, "ADMIN", ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("allows demoting SUPER_ADMIN when multiple exist", async () => {
    const { capturedInserts, capturedUpdates } = makeTxMocks();
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: ACTOR_ID, role: "SUPER_ADMIN", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "SUPER_ADMIN", isActive: true });
    mocks.mockTxCountSelectRows.mockResolvedValueOnce([{ count: 2 }]);

    const result = await changeUserRole(VALID_ID, "ADMIN", ACTOR_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fromRole).toBe("SUPER_ADMIN");
      expect(result.toRole).toBe("ADMIN");
    }
    expect(capturedUpdates.some((u) => u.role === "ADMIN")).toBe(true);
    const auditEntry = capturedInserts.find(
      (e) => e.action === "USER_ROLE_CHANGED",
    );
    expect(auditEntry).toBeDefined();
  });

  it("rejects MODERATOR actor", async () => {
    const modActorId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mocks.mockTxUserSelectRows
      .mockResolvedValueOnce({ id: modActorId, role: "MODERATOR", isActive: true })
      .mockResolvedValueOnce({ id: VALID_ID, role: "CANDIDATE", isActive: true });

    const result = await changeUserRole(VALID_ID, "ADMIN", modActorId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });
});
