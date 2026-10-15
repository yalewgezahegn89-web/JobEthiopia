import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockExpireDueJobs: vi.fn(),
  mockCheckDueSources: vi.fn(),
  mockPruneAnalyticsEvents: vi.fn(),
  mockRunAuthCleanup: vi.fn(),
}));

vi.mock("../expiration", () => ({
  expireDueJobs: (...args: unknown[]) => mocks.mockExpireDueJobs(...args),
}));

vi.mock("../sourceHealth", () => ({
  checkDueSources: (...args: unknown[]) => mocks.mockCheckDueSources(...args),
}));

vi.mock("@/lib/analytics/retention", () => ({
  pruneAnalyticsEvents: (...args: unknown[]) => mocks.mockPruneAnalyticsEvents(...args),
}));

vi.mock("../authCleanup", () => ({
  runAuthCleanup: (...args: unknown[]) => mocks.mockRunAuthCleanup(...args),
}));

import { runMaintenance } from "../run";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockPruneAnalyticsEvents.mockResolvedValue({ pruned: 0 });
  mocks.mockRunAuthCleanup.mockResolvedValue({ emailVerificationsPruned: 0, loginFailuresPruned: 0 });
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
      analyticsEventsPruned: 0,
      emailVerificationsPruned: 0,
      loginFailuresPruned: 0,
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
      analyticsEventsPruned: 0,
      emailVerificationsPruned: 0,
      loginFailuresPruned: 0,
    });
  });

  it("prunes analytics events with the run timestamp", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 0 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    });
    mocks.mockPruneAnalyticsEvents.mockResolvedValue({ pruned: 42 });

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(mocks.mockPruneAnalyticsEvents).toHaveBeenCalledWith(
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(result.analyticsEventsPruned).toBe(42);
  });

  it("analytics retention failure does not break the maintenance run", async () => {
    mocks.mockExpireDueJobs.mockResolvedValue({ expired: 2 });
    mocks.mockCheckDueSources.mockResolvedValue({
      checked: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
    });
    mocks.mockPruneAnalyticsEvents.mockRejectedValue(
      new Error("analytics table unavailable"),
    );

    const result = await runMaintenance(new Date("2026-06-01T00:00:00Z"));
    expect(result.expiredJobs).toBe(2);
    expect(result.sourcesChecked).toBe(3);
    expect(result.analyticsEventsPruned).toBe(0);
  });

  it("DB/system failure is handled safely", async () => {
    mocks.mockExpireDueJobs.mockRejectedValue(new Error("DB unavailable"));

    await expect(
      runMaintenance(new Date("2026-06-01T00:00:00Z")),
    ).rejects.toThrow("DB unavailable");
  });
});
