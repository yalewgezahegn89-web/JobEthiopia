import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
  mockGetCurrentLocale: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mocks.mockInsert(...args);
      return {
        values: (...args2: unknown[]) => mocks.mockValues(...args2),
      };
    },
  },
}));

vi.mock("@/lib/observability/logger", () => ({
  logWarn: (...args: unknown[]) => mocks.mockLogWarn(...args),
  logError: (...args: unknown[]) => mocks.mockLogError(...args),
}));

vi.mock("@/lib/i18n/server", () => ({
  getCurrentLocale: (...args: unknown[]) => mocks.mockGetCurrentLocale(...args),
}));

import {
  isMatchEvent,
  sanitizeMatchMetadata,
  trackMatchEvent,
  MATCH_EVENTS,
  type MatchEventName,
} from "../matchingEvents";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockValues.mockResolvedValue(undefined);
  mocks.mockGetCurrentLocale.mockResolvedValue("en");
  vi.stubEnv("ANALYTICS_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMatchEvent", () => {
  it("accepts the allowlisted matching event", () => {
    expect(isMatchEvent("match_recommendations_viewed")).toBe(true);
  });

  it("rejects unknown and non-string values", () => {
    expect(isMatchEvent("page_view")).toBe(false);
    expect(isMatchEvent("job_viewed")).toBe(false);
    expect(isMatchEvent("")).toBe(false);
    expect(isMatchEvent(null)).toBe(false);
    expect(isMatchEvent(42)).toBe(false);
  });

  it("keeps the allowlist focused on the recommendation view", () => {
    expect(MATCH_EVENTS).toEqual(["match_recommendations_viewed"]);
  });
});

describe("sanitizeMatchMetadata", () => {
  it("keeps only bounded resultCount", () => {
    expect(
      sanitizeMatchMetadata("match_recommendations_viewed", {
        resultCount: 7,
        injected: "never stored",
      }),
    ).toEqual({ resultCount: 7 });
  });

  it("binds resultCount to [0, 1000] and drops non-finite values", () => {
    expect(
      sanitizeMatchMetadata("match_recommendations_viewed", { resultCount: 5000 }),
    ).toEqual({ resultCount: 1000 });
    expect(
      sanitizeMatchMetadata("match_recommendations_viewed", { resultCount: -3 }),
    ).toEqual({ resultCount: 0 });
    expect(
      sanitizeMatchMetadata("match_recommendations_viewed", { resultCount: Number.NaN }),
    ).toEqual({});
    expect(
      sanitizeMatchMetadata("match_recommendations_viewed", { resultCount: "7" }),
    ).toEqual({});
  });

  it("returns {} for empty metadata", () => {
    expect(sanitizeMatchMetadata("match_recommendations_viewed", undefined)).toEqual({});
  });
});

describe("trackMatchEvent", () => {
  it("inserts the event with resultCount metadata and null jobId", async () => {
    await trackMatchEvent({
      event: "match_recommendations_viewed",
      locale: "en",
      metadata: { resultCount: 3 },
    });

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "match_recommendations_viewed",
      jobId: null,
      locale: "en",
      metadata: { resultCount: 3 },
    });
  });

  it("rejects unknown event names without inserting", async () => {
    await trackMatchEvent({
      event: "page_view" as MatchEventName,
      metadata: { resultCount: 1 },
    });

    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "UNKNOWN_MATCH_EVENT",
      event: "page_view",
    });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("rejects events carrying no useful metadata", async () => {
    await trackMatchEvent({
      event: "match_recommendations_viewed",
      metadata: { somethingElse: true },
    });

    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "EMPTY_MATCH_METADATA",
      event: "match_recommendations_viewed",
    });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("skips entirely when analytics is disabled", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");

    await trackMatchEvent({
      event: "match_recommendations_viewed",
      metadata: { resultCount: 2 },
    });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("never throws when the DB insert fails", async () => {
    mocks.mockValues.mockRejectedValue(new Error("db unavailable"));

    await expect(
      trackMatchEvent({
        event: "match_recommendations_viewed",
        metadata: { resultCount: 1 },
      }),
    ).resolves.toBeUndefined();

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({
        event: "match_recommendations_viewed",
        errorCode: "CAPTURE_FAILED",
      }),
    );
  });

  it("resolves locale through the server when none is provided", async () => {
    mocks.mockGetCurrentLocale.mockResolvedValue("am");

    await trackMatchEvent({
      event: "match_recommendations_viewed",
      metadata: { resultCount: 1 },
    });

    expect(mocks.mockGetCurrentLocale).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "am" }),
    );
  });

  it("falls back to en when getCurrentLocale rejects", async () => {
    mocks.mockGetCurrentLocale.mockRejectedValue(new Error("no session"));

    await trackMatchEvent({
      event: "match_recommendations_viewed",
      metadata: { resultCount: 1 },
    });

    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });
});