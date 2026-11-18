import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueTelegramPublication } from "../enqueue";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflictDoNothing: vi.fn(),
}));

type Transaction = Parameters<typeof enqueueTelegramPublication>[0];

function makeTx(): Transaction {
  mocks.mockValues.mockReturnValue({
    onConflictDoNothing: mocks.mockOnConflictDoNothing,
  });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
  return { insert: mocks.mockInsert } as unknown as Transaction;
}

describe("enqueueTelegramPublication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockOnConflictDoNothing.mockResolvedValue(undefined);
  });

  it("inserts one QUEUED row and uses ON CONFLICT DO NOTHING", async () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const tx = makeTx();

    await enqueueTelegramPublication(tx, {
      jobId: "job-1",
      channel: "@jobs",
      now,
    });

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith({
      jobId: "job-1",
      channel: "@jobs",
      state: "QUEUED",
      attempts: 0,
      nextRetryAt: now,
    });
    expect(mocks.mockOnConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it("propagates enqueue failures to the caller", async () => {
    const tx = makeTx();
    mocks.mockOnConflictDoNothing.mockRejectedValueOnce(
      new Error("insert failed"),
    );

    await expect(
      enqueueTelegramPublication(tx, {
        jobId: "job-1",
        channel: "@jobs",
        now: new Date(),
      }),
    ).rejects.toThrow("insert failed");
  });
});
