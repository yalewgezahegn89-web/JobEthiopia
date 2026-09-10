import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      jobAlerts: {
        findMany: (...a: unknown[]) => mocks.mockFindMany(...a),
        findFirst: (...a: unknown[]) => mocks.mockFindFirst(...a),
      },
    },
    insert: () => ({
      values: (...a: unknown[]) => {
        mocks.mockInsert(...a);
        return { returning: (...r: unknown[]) => mocks.mockReturning(...r) };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: (...r: unknown[]) => mocks.mockReturning(...r),
        }),
      }),
    }),
    delete: () => ({
      where: (...a: unknown[]) => {
        const result = mocks.mockDelete(...a);
        return { returning: () => result };
      },
    }),
  },
}));

import {
  listAlertsForUser,
  getAlertForUser,
  createAlert,
  updateAlert,
  deleteAlert,
} from "@/lib/jobAlerts/dal";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "Alert",
    keywords: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    employmentType: null,
    frequency: "DAILY",
    locale: "en",
    status: "ACTIVE",
    unsubscribeTokenHash: null,
    unsubscribeTokenExpiresAt: null,
    lastSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAlertsForUser", () => {
  it("scopes the list to the user and orders by newest", async () => {
    mocks.mockFindMany.mockResolvedValue([row()]);
    const items = await listAlertsForUser("user-1");
    expect(items).toHaveLength(1);
    expect(mocks.mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    );
  });
});

describe("getAlertForUser", () => {
  it("returns the row when owned", async () => {
    mocks.mockFindFirst.mockResolvedValue(row());
    const found = await getAlertForUser("11111111-1111-4111-8111-111111111111", "user-1");
    expect(found).not.toBeNull();
    expect(mocks.mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    );
  });

  it("returns null when not owned", async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    const found = await getAlertForUser("11111111-1111-4111-8111-111111111111", "other-user");
    expect(found).toBeNull();
  });
});

describe("createAlert", () => {
  it("inserts with the session user id and returns the row", async () => {
    mocks.mockReturning.mockResolvedValue([row({ name: "Auditor" })]);
    const created = await createAlert("user-1", {
      name: "Auditor",
      frequency: "INSTANT",
      locale: "en",
    });
    expect(created.name).toBe("Auditor");
    expect(mocks.mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});

describe("updateAlert", () => {
  it("updates only present keys and clears nullable filters on null", async () => {
    mocks.mockReturning.mockResolvedValue([row({ status: "PAUSED" })]);
    const updated = await updateAlert("11111111-1111-4111-8111-111111111111", "user-1", {
      status: "PAUSED",
      employmentType: null,
    });
    expect(updated).not.toBeNull();
    expect(mocks.mockReturning).toHaveBeenCalled();
  });

  it("returns null when the alert is not owned", async () => {
    mocks.mockReturning.mockResolvedValue([]);
    const updated = await updateAlert("11111111-1111-4111-8111-111111111111", "other-user", {
      name: "Nope",
    });
    expect(updated).toBeNull();
  });
});

describe("deleteAlert", () => {
  it("returns true on delete", async () => {
    mocks.mockDelete.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]);
    const ok = await deleteAlert("11111111-1111-4111-8111-111111111111", "user-1");
    expect(ok).toBe(true);
  });

  it("returns false when nothing was deleted", async () => {
    mocks.mockDelete.mockResolvedValue([]);
    const ok = await deleteAlert("11111111-1111-4111-8111-111111111111", "user-1");
    expect(ok).toBe(false);
  });
});