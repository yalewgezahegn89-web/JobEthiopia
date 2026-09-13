import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockWhere: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (sql: unknown) => mocks.mockWhere(sql),
      }),
    }),
  },
}));

import { getMonetizationCounts } from "../summary";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockWhere.mockResolvedValue([{ count: 0 }]);
});

describe("getMonetizationCounts", () => {
  it("counts ad impressions and clicks over the default 30-day window", async () => {
    mocks.mockWhere
      .mockResolvedValueOnce([{ count: 42 }])
      .mockResolvedValueOnce([{ count: 7 }]);

    const result = await getMonetizationCounts(
      new Date("2026-06-15T00:00:00.000Z"),
    );

    expect(result).toEqual({ impressions: 42, clicks: 7 });
    expect(mocks.mockWhere).toHaveBeenCalledTimes(2);
  });

  it("normalizes string row counts", async () => {
    mocks.mockWhere
      .mockResolvedValueOnce([{ count: "12" }])
      .mockResolvedValueOnce([]);

    const result = await getMonetizationCounts();

    expect(result).toEqual({ impressions: 12, clicks: 0 });
  });

  it("returns zeros when no rows exist", async () => {
    const result = await getMonetizationCounts();

    expect(result).toEqual({ impressions: 0, clicks: 0 });
  });
});