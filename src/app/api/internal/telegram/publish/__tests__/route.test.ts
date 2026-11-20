import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  processTelegramOutbox: vi.fn(),
  writeAuditLog: vi.fn(),
  reportError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  getRequestId: vi.fn().mockResolvedValue("req-test-123"),
}));

vi.mock("@/lib/telegram/outbox", () => ({
  TELEGRAM_OUTBOX_BATCH_SIZE: 20,
  processTelegramOutbox: (...args: unknown[]) =>
    mocks.processTelegramOutbox(...args),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mocks.writeAuditLog(...args),
}));

vi.mock("@/lib/observability/errors", () => ({
  reportError: (...args: unknown[]) => mocks.reportError(...args),
}));

vi.mock("@/lib/observability/logger", () => ({
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
  logInfo: (...args: unknown[]) => mocks.logInfo(...args),
  logError: (...args: unknown[]) => mocks.logError(...args),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: () => mocks.getRequestId(),
}));

import { POST } from "../route";

const FALLBACK_KEY = "test-maintenance-key-123";
const DEDICATED_KEY = "test-telegram-key-456";

const OUTBOX_RESULT = {
  configured: true,
  reason: null,
  recovered: 1,
  claimed: 2,
  sent: 3,
  retried: 4,
  failed: 0,
  skipped: 0,
};

function makeRequest(options: { key?: string; query?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (options.key !== undefined) {
    headers["x-maintenance-key"] = options.key;
  }
  return new Request(
    `http://localhost/api/internal/telegram/publish${options.query ?? ""}`,
    { method: "POST", headers },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTERNAL_TELEGRAM_API_KEY", "");
  vi.stubEnv("MAINTENANCE_API_KEY", FALLBACK_KEY);
  mocks.processTelegramOutbox.mockResolvedValue(OUTBOX_RESULT);
  mocks.writeAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/telegram/publish", () => {
  describe("authentication", () => {
    it("fails closed with 500 when no internal key is configured", async () => {
      vi.stubEnv("INTERNAL_TELEGRAM_API_KEY", "");
      vi.stubEnv("MAINTENANCE_API_KEY", "");

      const response = await POST(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Server configuration error",
      });
      expect(mocks.processTelegramOutbox).not.toHaveBeenCalled();
      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    });

    it("returns 401 when the request key is missing", async () => {
      const response = await POST(makeRequest());

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(mocks.processTelegramOutbox).not.toHaveBeenCalled();
    });

    it("returns 401 when the request key is incorrect", async () => {
      const response = await POST(makeRequest({ key: "wrong-key" }));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(mocks.processTelegramOutbox).not.toHaveBeenCalled();
    });

    it("authenticates with INTERNAL_TELEGRAM_API_KEY", async () => {
      vi.stubEnv("INTERNAL_TELEGRAM_API_KEY", DEDICATED_KEY);

      const response = await POST(makeRequest({ key: DEDICATED_KEY }));

      expect(response.status).toBe(200);
      expect(mocks.processTelegramOutbox).toHaveBeenCalledWith(20);

      const fallbackResponse = await POST(makeRequest({ key: FALLBACK_KEY }));
      expect(fallbackResponse.status).toBe(401);
      expect(mocks.processTelegramOutbox).toHaveBeenCalledTimes(1);
    });

    it("authenticates with MAINTENANCE_API_KEY when the dedicated key is absent", async () => {
      const response = await POST(makeRequest({ key: FALLBACK_KEY }));

      expect(response.status).toBe(200);
      expect(mocks.processTelegramOutbox).toHaveBeenCalledWith(20);
    });
  });

  describe("limit validation", () => {
    it.each(["abc", "0", "-1", "1.5"])(
      "returns 400 for invalid limit %s",
      async (limit) => {
        const response = await POST(
          makeRequest({
            key: FALLBACK_KEY,
            query: `?limit=${encodeURIComponent(limit)}`,
          }),
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Invalid limit" });
        expect(mocks.processTelegramOutbox).not.toHaveBeenCalled();
      },
    );

    it("clamps a limit greater than 20 to 20", async () => {
      const response = await POST(
        makeRequest({ key: FALLBACK_KEY, query: "?limit=100" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.processTelegramOutbox).toHaveBeenCalledWith(20);
    });

    it("invokes the worker with the requested valid limit", async () => {
      const response = await POST(
        makeRequest({ key: FALLBACK_KEY, query: "?limit=7" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.processTelegramOutbox).toHaveBeenCalledWith(7);
      expect(await response.json()).toEqual(OUTBOX_RESULT);
    });
  });

  describe("audit and failure behavior", () => {
    it("writes the expected TELEGRAM_OUTBOX_RUN audit information", async () => {
      const response = await POST(makeRequest({ key: FALLBACK_KEY }));

      expect(response.status).toBe(200);
      expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
      expect(mocks.writeAuditLog).toHaveBeenCalledWith({
        action: "TELEGRAM_OUTBOX_RUN",
        targetType: "telegram",
        targetId: "outbox",
        metadata: {
          configured: true,
          reason: null,
          recovered: 1,
          claimed: 2,
          sent: 3,
          retried: 4,
          failed: 0,
          skipped: 0,
        },
      });
      expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(
        FALLBACK_KEY,
      );
    });

    it("returns 500 and reports an unexpected worker failure", async () => {
      const failure = new Error("worker failed");
      mocks.processTelegramOutbox.mockRejectedValueOnce(failure);

      const response = await POST(makeRequest({ key: FALLBACK_KEY }));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(mocks.reportError).toHaveBeenCalledWith(
        "telegram_outbox_run_failed",
        failure,
        expect.objectContaining({
          route: "/api/internal/telegram/publish",
          method: "POST",
          status: 500,
        }),
      );
      expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    });
  });
});
