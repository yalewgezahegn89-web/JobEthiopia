import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetConfig: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observability/logger", () => ({
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("../config", () => ({
  getTelegramBotConfig: (...args: unknown[]) => mocks.mockGetConfig(...args),
}));

vi.mock("../client", () => ({
  sendTelegramMessage: vi.fn(),
}));

vi.mock("../templates", () => ({
  buildTelegramPublicationText: vi.fn(),
  renderTelegramMessage: vi.fn(),
}));

import {
  isStaleSending,
  processTelegramOutbox,
  reclaimStaleSendingPublications,
  TELEGRAM_SENDING_LEASE_MS,
} from "../outbox";

interface StaleRow {
  id: string;
  jobId: string;
  attempts: number;
  maxAttempts: number;
}

function setupReclaim(rows: StaleRow[]) {
  const forFn = vi.fn().mockResolvedValue(rows);
  const limitFn = vi.fn().mockReturnValue({ for: forFn });
  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
  const whereSelectFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereSelectFn });
  mocks.mockSelect.mockReturnValue({ from: fromFn });

  const updates: Array<Record<string, unknown>> = [];
  const whereUpdateFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn((values: Record<string, unknown>) => {
    updates.push(values);
    return { where: whereUpdateFn };
  });
  mocks.mockUpdate.mockReturnValue({ set: setFn });

  mocks.mockTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ select: mocks.mockSelect, update: mocks.mockUpdate }),
  );

  return { forFn, updates, whereSelectFn, setFn };
}

const NOW = new Date("2026-11-09T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isStaleSending", () => {
  it("does not treat a recently claimed row as stale", () => {
    const recent = new Date(NOW.getTime() - TELEGRAM_SENDING_LEASE_MS + 1);
    expect(isStaleSending(recent, NOW)).toBe(false);
  });

  it("treats a row at or beyond the lease as stale", () => {
    expect(
      isStaleSending(
        new Date(NOW.getTime() - TELEGRAM_SENDING_LEASE_MS),
        NOW,
      ),
    ).toBe(true);
    expect(
      isStaleSending(
        new Date(NOW.getTime() - TELEGRAM_SENDING_LEASE_MS - 60_000),
        NOW,
      ),
    ).toBe(true);
  });
});

describe("reclaimStaleSendingPublications", () => {
  it("requeues a stale row with an incremented attempt and sanitized reason", async () => {
    const { updates } = setupReclaim([
      { id: "pub-1", jobId: "job-1", attempts: 0, maxAttempts: 5 },
    ]);

    const recovered = await reclaimStaleSendingPublications(NOW);

    expect(recovered).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      state: "RETRY",
      attempts: 1,
      nextRetryAt: NOW,
      updatedAt: NOW,
    });
    expect(String(updates[0].lastError)).toContain("lease expired");
  });

  it("fails a stale row when the retry budget is exhausted", async () => {
    const { updates } = setupReclaim([
      { id: "pub-2", jobId: "job-2", attempts: 4, maxAttempts: 5 },
    ]);

    const recovered = await reclaimStaleSendingPublications(NOW);

    expect(recovered).toBe(1);
    expect(updates[0]).toMatchObject({
      state: "FAILED",
      attempts: 5,
      nextRetryAt: null,
      updatedAt: NOW,
    });
    expect(String(updates[0].lastError)).toContain("retry limit");
  });

  it("serializes recovery with FOR UPDATE SKIP LOCKED", async () => {
    const { forFn } = setupReclaim([]);

    const recovered = await reclaimStaleSendingPublications(NOW);

    expect(recovered).toBe(0);
    expect(forFn).toHaveBeenCalledWith("update", { skipLocked: true });
  });

  it("only selects SENDING rows older than the lease cutoff", async () => {
    const { whereSelectFn } = setupReclaim([]);

    await reclaimStaleSendingPublications(NOW);

    expect(whereSelectFn).toHaveBeenCalledTimes(1);
  });
});

describe("processTelegramOutbox stale recovery", () => {
  it("recovers stale SENDING rows before the claim cycle", async () => {
    mocks.mockGetConfig.mockReturnValue({
      ok: false,
      reason: "TELEGRAM_BOT_TOKEN is not configured",
    });
    const { updates } = setupReclaim([
      { id: "pub-3", jobId: "job-3", attempts: 1, maxAttempts: 5 },
    ]);

    const result = await processTelegramOutbox(10);

    expect(result).toMatchObject({
      configured: false,
      recovered: 1,
      claimed: 0,
      sent: 0,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].state).toBe("RETRY");
  });
});
