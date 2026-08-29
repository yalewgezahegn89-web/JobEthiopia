import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockExpireDueJobs: vi.fn(),
  mockCheckDueSources: vi.fn(),
}));

vi.mock("../expiration", () => ({
  expireDueJobs: (...args: unknown[]) => mocks.mockExpireDueJobs(...args),
}));

vi.mock("../sourceHealth", () => ({
  checkDueSources: (...args: unknown[]) => mocks.mockCheckDueSources(...args),
}));

import { runMaintenance } from "../run";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runMaintenance", () => {
  it("runs job expiration", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 5 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(mocks.mockExpireDueJobs).toHaveBeenCalledWith(
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(result.expiredJobs).toBe(5);
  });

  it("runs source health checks", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 0 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
    });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(mocks.mockCheckDueSources).toHaveBeenCalledWith(
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(result.sourcesChecked).toBe(3);
    expect(result.sourcesSucceeded).toBe(2);
    expect(result.sourcesFailed).toBe(1);
  });

  it("combines counts correctly", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 12 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 5,
      succeeded: 3,
      failed: 1,
      skipped: 1,
    });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(result).toEqual({
      expiredJobs: 12,
      sourcesChecked: 5,
      sourcesSucceeded: 3,
      sourcesFailed: 1,
      sourcesSkipped: 1,
    });
  });

  it("partial source failure still returns summary", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 2 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 4,
      succeeded: 1,
      failed: 3,
      skipped: 0,
    });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(result.expiredJobs).toBe(2);
    expect(result.sourcesFailed).toBe(3);
  });

  it("empty workload returns zero counts", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 0 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(result).toEqual({
      expiredJobs: 0,
      sourcesChecked: 0,
      sourcesSucceeded: 0,
      sourcesFailed: 0,
      sourcesSkipped: 0,
    });
  });

  it("DB/system failure is handled safely", async () => {
    mocks.mockExpireDueJobs.mockRejectedValue(new Error("DB unavailable"));

    await expect(
      runMaintenance(new Date("2026-06-01T00:00:00Z")),
    ).rejects.toThrow("DB unavailable");
  });
});
