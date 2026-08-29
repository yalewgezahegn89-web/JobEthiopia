import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockIsSourceDueForCheck: vi.fn(),
  mockRecordSuccessfulCheck: vi.fn(),
  mockRecordFailedCheck: vi.fn(),
  mockSsrfFetch: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.mockSelect(...args),
  },
}));

vi.mock("@/db/schema/sources", () => ({
  sources: {
    id: "sources_id",
    name: "sources_name",
    baseUrl: "sources_baseUrl",
    isActive: "sources_isActive",
    lastSuccessfulCheck: "sources_lastSuccessfulCheck",
    checkFrequencyMinutes: "sources_checkFrequencyMinutes",
    consecutiveFailures: "sources_consecutiveFailures",
  },
}));

vi.mock("@/lib/sources/health", () => ({
  isSourceDueForCheck: (...args: unknown[]) =>
    mocks.mockIsSourceDueForCheck(...args),
  recordSuccessfulCheck: (...args: unknown[]) =>
    mocks.mockRecordSuccessfulCheck(...args),
  recordFailedCheck: (...args: unknown[]) =>
    mocks.mockRecordFailedCheck(...args),
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: mocks.mockSsrfFetch,
  SsrfError: class SsrfError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SsrfError";
    }
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  asc: vi.fn((val: unknown) => val),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join("?"),
    values,
  })),
  and: vi.fn((...args: unknown[]) => args),
}));

import { checkDueSources } from "../sourceHealth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRecordSuccessfulCheck.mockResolvedValue({
    sourceId: "src-1",
    lastSuccessfulCheck: new Date(),
    lastAttemptedCheck: new Date(),
    lastError: null,
    checkFrequencyMinutes: 60,
    consecutiveFailures: 0,
  });
  mocks.mockRecordFailedCheck.mockResolvedValue({
    sourceId: "src-1",
    lastSuccessfulCheck: null,
    lastAttemptedCheck: new Date(),
    lastError: "fail",
    checkFrequencyMinutes: 60,
    consecutiveFailures: 1,
  });
});

function mockSelectReturn(rows: unknown[]) {
  mocks.mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

function makeSourceRow(
  id: string,
  baseUrl: string | null = "https://example.com",
) {
  return {
    id,
    name: `Source ${id}`,
    baseUrl,
    lastSuccessfulCheck: null,
    checkFrequencyMinutes: 60,
  };
}

describe("checkDueSources", () => {
  describe("source selection", () => {
    it("includes due sources", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockResolvedValue({
        ok: true,
      });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(1);
      expect(result.succeeded).toBe(1);
    });

    it("skips non-due sources", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(false);

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(0);
      expect(mocks.mockSsrfFetch).not.toHaveBeenCalled();
    });

    it("marks never-successfully-checked source as due", async () => {
      const source = makeSourceRow("src-1");
      source.lastSuccessfulCheck = null;
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockResolvedValue({
        ok: true,
      });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(1);
    });

    it("marks null-frequency source as due", async () => {
      const source = makeSourceRow("src-1");
      source.checkFrequencyMinutes = null as unknown as number;
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockResolvedValue({
        ok: true,
      });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(1);
    });
  });

  describe("health check execution", () => {
    it("records success on HTTP 200", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockResolvedValue({
        ok: true,
      });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.succeeded).toBe(1);
      expect(mocks.mockRecordSuccessfulCheck).toHaveBeenCalledWith("src-1");
    });

    it("records failure on HTTP 500", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.failed).toBe(1);
      expect(mocks.mockRecordFailedCheck).toHaveBeenCalledWith(
        "src-1",
        "HTTP 500",
      );
    });

    it("records failure on network error", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);
      mocks.mockSsrfFetch.mockRejectedValue(
        new Error("DNS lookup failed"),
      );

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.failed).toBe(1);
      expect(mocks.mockRecordFailedCheck).toHaveBeenCalledWith(
        "src-1",
        "DNS lookup failed",
      );
    });
  });

  describe("failure isolation", () => {
    it("one failed source does not stop other sources", async () => {
      const source1 = makeSourceRow("src-1");
      const source2 = makeSourceRow("src-2");
      mockSelectReturn([source1, source2]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);

      mocks.mockSsrfFetch
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({ ok: true });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.checked).toBe(2);
    });
  });

  describe("limits", () => {
    it("queries with limit of 100 sources", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      });

      await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(mockLimit).toHaveBeenCalledWith(100);
    });
  });

  describe("missing baseUrl", () => {
    it("skips source with null baseUrl", async () => {
      const source = makeSourceRow("src-1", null);
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.skipped).toBe(1);
      expect(result.checked).toBe(0);
      expect(mocks.mockSsrfFetch).not.toHaveBeenCalled();
    });
  });

  describe("deterministic time", () => {
    it("uses injected now for consistent results", async () => {
      const now = new Date("2026-06-01T00:00:00Z");
      mockSelectReturn([]);
      const result = await checkDueSources(now);
      expect(result.checked).toBe(0);
    });
  });

  describe("counts", () => {
    it("returns correct counts for mixed outcomes", async () => {
      const sources = [
        makeSourceRow("src-ok"),
        makeSourceRow("src-fail"),
        makeSourceRow("src-skip", null),
      ];
      mockSelectReturn(sources);
      mocks.mockIsSourceDueForCheck.mockResolvedValue(true);

      mocks.mockSsrfFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it("returns zero counts when no active sources", async () => {
      mockSelectReturn([]);
      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.checked).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe("error handling", () => {
    it("counts source as failed when isSourceDueForCheck throws", async () => {
      const source = makeSourceRow("src-1");
      mockSelectReturn([source]);
      mocks.mockIsSourceDueForCheck.mockRejectedValue(new Error("DB error"));

      const result = await checkDueSources(new Date("2026-06-01T00:00:00Z"));
      expect(result.failed).toBe(1);
      expect(result.checked).toBe(0);
    });
  });
});
