import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockAuditFindMany: vi.fn(),
  mockCountRows: vi.fn(),
  mockActorSelectRows: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      auditLog: {
        findMany: (...args: unknown[]) => mocks.mockAuditFindMany(...args),
      },
    },
    select: (fields: Record<string, unknown>) => {
      if (fields && "count" in fields) {
        return {
          from: () => ({
            where: () => mocks.mockCountRows(),
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
      return {
        from: () => ({
          where: () => mocks.mockCountRows(),
        }),
      };
    },
  },
}));

import { listAuditLogs } from "@/lib/admin/audit";

const NOW = new Date("2026-03-15T10:00:00.000Z");
const EARLIER = new Date("2026-03-14T09:00:00.000Z");
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    action: "USER_ROLE_CHANGED",
    targetType: "user",
    targetId: "22222222-2222-4222-8222-222222222222",
    metadata: { fromRole: "MODERATOR", toRole: "ADMIN" },
    createdAt: NOW,
    actorUserId: ACTOR_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);
  mocks.mockActorSelectRows.mockResolvedValue([]);
});

describe("listAuditLogs", () => {
  it("returns paginated results newest-first", async () => {
    const row1 = makeRow({ id: "aaa", createdAt: NOW });
    const row2 = makeRow({ id: "bbb", createdAt: EARLIER });
    mocks.mockAuditFindMany.mockResolvedValue([row1, row2]);
    mocks.mockCountRows.mockResolvedValue([{ count: 2 }]);
    mocks.mockActorSelectRows.mockResolvedValue([
      { id: ACTOR_ID, email: "admin@example.com" },
    ]);

    const result = await listAuditLogs({});

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("aaa");
    expect(result.items[1].id).toBe("bbb");
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
  });

  it("caps page limit at 50", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    await listAuditLogs({ page: 1 });

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.limit).toBe(50);
  });

  it("paginates correctly", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 120 }]);

    const page2 = await listAuditLogs({ page: 2 });

    expect(page2.page).toBe(2);
    expect(page2.total).toBe(120);
    expect(page2.totalPages).toBe(3);

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.offset).toBe(50);
  });

  it("applies action filter", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    await listAuditLogs({ action: "LOGIN_FAILURE" });

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.where).toBeDefined();
  });

  it("applies targetType filter", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    await listAuditLogs({ targetType: "user" });

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.where).toBeDefined();
  });

  it("applies actorUserId filter", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    await listAuditLogs({ actorUserId: ACTOR_ID });

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.where).toBeDefined();
  });

  it("returns empty for no matches", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    const result = await listAuditLogs({ action: "NONEXISTENT" });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("resolves actor emails in batch", async () => {
    const row = makeRow({ actorUserId: ACTOR_ID });
    mocks.mockAuditFindMany.mockResolvedValue([row]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);
    mocks.mockActorSelectRows.mockResolvedValue([
      { id: ACTOR_ID, email: "admin@example.com" },
    ]);

    const result = await listAuditLogs({});

    expect(result.items[0].actorEmail).toBe("admin@example.com");
    expect(mocks.mockActorSelectRows).toHaveBeenCalledTimes(1);
  });

  it("shows null actorEmail for system events", async () => {
    const row = makeRow({ actorUserId: null });
    mocks.mockAuditFindMany.mockResolvedValue([row]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listAuditLogs({});

    expect(result.items[0].actorEmail).toBeNull();
  });

  it("never returns passwordHash or sensitive fields", async () => {
    const row = makeRow({
      metadata: { password: "secret", token: "abc", name: "safe" },
    });
    mocks.mockAuditFindMany.mockResolvedValue([row]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listAuditLogs({});

    const meta = result.items[0].metadata as Record<string, unknown>;
    expect(meta).not.toHaveProperty("password");
    expect(meta).not.toHaveProperty("token");
    expect(meta).toHaveProperty("name", "safe");
  });

  it("clamps page to 1 for invalid values", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    const result = await listAuditLogs({ page: -5 });

    expect(result.page).toBe(1);

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.offset).toBe(0);
  });

  it("orders by createdAt DESC, id DESC", async () => {
    mocks.mockAuditFindMany.mockResolvedValue([]);
    mocks.mockCountRows.mockResolvedValue([{ count: 0 }]);

    await listAuditLogs({});

    const findManyCall = mocks.mockAuditFindMany.mock.calls[0][0];
    expect(findManyCall.orderBy).toBeDefined();
    expect(Array.isArray(findManyCall.orderBy)).toBe(true);
    expect(findManyCall.orderBy).toHaveLength(2);
  });

  it("returns ISO string for createdAt", async () => {
    const row = makeRow({ createdAt: NOW });
    mocks.mockAuditFindMany.mockResolvedValue([row]);
    mocks.mockCountRows.mockResolvedValue([{ count: 1 }]);

    const result = await listAuditLogs({});

    expect(result.items[0].createdAt).toBe("2026-03-15T10:00:00.000Z");
  });
});
