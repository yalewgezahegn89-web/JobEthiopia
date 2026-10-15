import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
    update: () => ({
      set: () => ({
        where: (...args: unknown[]) => mocks.mockUpdate(...args),
      }),
    }),
  },
}));

vi.mock("@/db/schema/sources", () => ({
  sources: { id: "sources_id_column", isActive: "is_active", consecutiveFailures: "consecutive_failures", updatedAt: "updated_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

import {
  autoDeactivateIfUnhealthy,
  AUTO_DEACTIVATE_THRESHOLD,
} from "../health";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockUpdate.mockResolvedValue([]);
});

describe("autoDeactivateIfUnhealthy", () => {
  it("returns false when source does not exist", async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
  });

  it("returns false when source is already inactive", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: false,
      consecutiveFailures: 15,
    });
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
  });

  it("returns false when consecutiveFailures is below threshold", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: true,
      consecutiveFailures: AUTO_DEACTIVATE_THRESHOLD - 1,
    });
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("returns false when consecutiveFailures equals threshold minus one", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: true,
      consecutiveFailures: AUTO_DEACTIVATE_THRESHOLD - 2,
    });
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
  });

  it("deactivates source when consecutiveFailures reaches threshold", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: true,
      consecutiveFailures: AUTO_DEACTIVATE_THRESHOLD,
    });
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(true);
    expect(mocks.mockUpdate).toHaveBeenCalled();
  });

  it("deactivates source when consecutiveFailures exceeds threshold", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: true,
      consecutiveFailures: AUTO_DEACTIVATE_THRESHOLD + 5,
    });
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(true);
    expect(mocks.mockUpdate).toHaveBeenCalled();
  });

  it("returns false when DB query fails", async () => {
    mocks.mockFindFirst.mockRejectedValue(new Error("DB down"));
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
  });

  it("returns false when update fails", async () => {
    mocks.mockFindFirst.mockResolvedValue({
      isActive: true,
      consecutiveFailures: AUTO_DEACTIVATE_THRESHOLD,
    });
    mocks.mockUpdate.mockRejectedValue(new Error("DB down"));
    const result = await autoDeactivateIfUnhealthy("source-1");
    expect(result).toBe(false);
  });
});
