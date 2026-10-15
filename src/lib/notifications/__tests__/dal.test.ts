import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (...args: unknown[]) => {
        mocks.mockInsert(...args);
        return {
          returning: () => mocks.mockInsert(),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: (whereClause: unknown) => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => mocks.mockSelect("list"),
            }),
          }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(mocks.mockSelect("count", whereClause)).then(resolve),
          catch: () => Promise.resolve(mocks.mockSelect("count")),
          finally: () => Promise.resolve(mocks.mockSelect("count")),
        }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(mocks.mockSelect("single")).then(resolve),
        catch: () => Promise.resolve(mocks.mockSelect("single")),
        finally: () => Promise.resolve(mocks.mockSelect("single")),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => mocks.mockUpdate(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(mocks.mockUpdate("no-returning")).then(resolve),
          catch: () => Promise.resolve(mocks.mockUpdate("no-returning")),
          finally: () => Promise.resolve(mocks.mockUpdate("no-returning")),
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => mocks.mockDelete(),
      }),
    }),
  },
}));

import {
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/lib/notifications/dal";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createNotification", () => {
  it("returns null when userId is missing", async () => {
    const result = await createNotification({ userId: "", type: "test" });
    expect(result).toBeNull();
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("returns null when type is missing", async () => {
    const result = await createNotification({ userId: "abc", type: "" });
    expect(result).toBeNull();
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("inserts and returns a row on success", async () => {
    const fakeRow = { id: "1", userId: "u1", type: "test" };
    mocks.mockInsert.mockReturnValue([fakeRow]);

    const result = await createNotification({
      userId: "u1",
      type: "test",
      data: { key: "value" },
      actionUrl: "/test",
    });

    expect(result).toEqual(fakeRow);
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it("returns null on db error", async () => {
    mocks.mockInsert.mockImplementation(() => {
      throw new Error("db down");
    });

    const result = await createNotification({ userId: "u1", type: "test" });
    expect(result).toBeNull();
  });
});

describe("listNotifications", () => {
  it("returns empty result for empty userId", async () => {
    const result = await listNotifications("");
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns paginated results", async () => {
    const fakeItems = [{ id: "1" }, { id: "2" }];
    mocks.mockSelect.mockReturnValueOnce(fakeItems); // list query
    mocks.mockSelect.mockReturnValueOnce([{ count: 5 }]); // total count
    mocks.mockSelect.mockReturnValueOnce([{ count: 2 }]); // unread count

    const result = await listNotifications("u1", { page: 1, limit: 20 });
    expect(result.items).toEqual(fakeItems);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("clamps invalid page to 1", async () => {
    mocks.mockSelect.mockReturnValue([]);
    mocks.mockSelect.mockReturnValue([{ count: 0 }]);
    mocks.mockSelect.mockReturnValue([{ count: 0 }]);

    const result = await listNotifications("u1", { page: -5 });
    expect(result.page).toBe(1);
  });

  it("clamps limit to NOTIFICATION_PAGE_LIMIT", async () => {
    mocks.mockSelect.mockReturnValue([]);
    mocks.mockSelect.mockReturnValue([{ count: 0 }]);
    mocks.mockSelect.mockReturnValue([{ count: 0 }]);

    const result = await listNotifications("u1", { limit: 999 });
    expect(result.limit).toBe(50);
  });
});

describe("getUnreadCount", () => {
  it("returns 0 for empty userId", async () => {
    const result = await getUnreadCount("");
    expect(result).toBe(0);
  });

  it("returns count from db", async () => {
    mocks.mockSelect.mockReturnValue([{ count: 7 }]);
    const result = await getUnreadCount("u1");
    expect(result).toBe(7);
  });

  it("returns 0 on db error", async () => {
    mocks.mockSelect.mockImplementation(() => {
      throw new Error("db error");
    });
    const result = await getUnreadCount("u1");
    expect(result).toBe(0);
  });
});

describe("markNotificationRead", () => {
  it("returns false for empty ids", async () => {
    expect(await markNotificationRead("", "u1")).toBe(false);
    expect(await markNotificationRead("abc", "")).toBe(false);
  });

  it("returns false for invalid UUID", async () => {
    expect(await markNotificationRead("not-a-uuid", "u1")).toBe(false);
  });

  it("returns true when row is updated", async () => {
    mocks.mockUpdate.mockReturnValue([{ id: "1" }]);
    const result = await markNotificationRead(
      "00000000-0000-0000-0000-000000000001",
      "u1",
    );
    expect(result).toBe(true);
  });

  it("returns false when no row is updated", async () => {
    mocks.mockUpdate.mockReturnValue([]);
    const result = await markNotificationRead(
      "00000000-0000-0000-0000-000000000001",
      "u1",
    );
    expect(result).toBe(false);
  });
});

describe("markAllNotificationsRead", () => {
  it("returns 0 for empty userId", async () => {
    const result = await markAllNotificationsRead("");
    expect(result).toBe(0);
  });

  it("returns count of updated rows", async () => {
    mocks.mockSelect.mockReturnValue([{ count: 2 }]);
    mocks.mockUpdate.mockReturnValue([]);
    const result = await markAllNotificationsRead("u1");
    expect(result).toBe(2);
  });

  it("returns 0 on db error", async () => {
    mocks.mockUpdate.mockImplementation(() => {
      throw new Error("db error");
    });
    const result = await markAllNotificationsRead("u1");
    expect(result).toBe(0);
  });
});

describe("deleteNotification", () => {
  it("returns false for empty ids", async () => {
    expect(await deleteNotification("", "u1")).toBe(false);
  });

  it("returns false for invalid UUID", async () => {
    expect(await deleteNotification("not-a-uuid", "u1")).toBe(false);
  });

  it("returns true when row is deleted", async () => {
    mocks.mockDelete.mockReturnValue([{ id: "1" }]);
    const result = await deleteNotification(
      "00000000-0000-0000-0000-000000000001",
      "u1",
    );
    expect(result).toBe(true);
  });

  it("returns false when no row is deleted", async () => {
    mocks.mockDelete.mockReturnValue([]);
    const result = await deleteNotification(
      "00000000-0000-0000-0000-000000000001",
      "u1",
    );
    expect(result).toBe(false);
  });
});
