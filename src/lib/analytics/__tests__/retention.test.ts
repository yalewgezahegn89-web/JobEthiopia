import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    delete: (...args: unknown[]) => {
      mocks.mockDelete(...args);
      return {
        where: (...args2: unknown[]) => mocks.mockWhere(...args2),
      };
    },
  },
}));

import {
  pruneAnalyticsEvents,
  analyticsRetentionCutoff,
  DEFAULT_ANALYTICS_RETENTION_DAYS,
} from "../retention";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyticsRetentionCutoff", () => {
  it("is 365 days before now by default", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(analyticsRetentionCutoff(now).toISOString()).toBe(
      "2025-06-01T00:00:00.000Z",
    );
    expect(DEFAULT_ANALYTICS_RETENTION_DAYS).toBe(365);
  });

  it("honors a custom retention window", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(analyticsRetentionCutoff(now, 30).toISOString()).toBe(
      "2026-05-02T00:00:00.000Z",
    );
  });
});

describe("pruneAnalyticsEvents", () => {
  it("deletes rows older than the retention window and reports the count", async () => {
    mocks.mockWhere.mockResolvedValue({ rowCount: 5 });
    const now = new Date("2026-06-01T00:00:00.000Z");

    const result = await pruneAnalyticsEvents(now);

    expect(mocks.mockDelete).toHaveBeenCalledTimes(1);
    expect(mocks.mockWhere).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pruned: 5 });
  });

  it("reports zero pruned when nothing is deleted", async () => {
    mocks.mockWhere.mockResolvedValue({ rowCount: 0 });
    const result = await pruneAnalyticsEvents(new Date());
    expect(result).toEqual({ pruned: 0 });
  });
});