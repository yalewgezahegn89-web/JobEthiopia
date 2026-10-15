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
  isAdEvent,
  sanitizeAdMetadata,
  trackAdEvent,
  AD_EVENTS,
  type AdEventName,
} from "../adEvents";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockValues.mockResolvedValue(undefined);
  mocks.mockGetCurrentLocale.mockResolvedValue("en");
  vi.stubEnv("MONETIZATION_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdEvent", () => {
  it("accepts both allowlisted ad events", () => {
    expect(isAdEvent("ad_impression")).toBe(true);
    expect(isAdEvent("ad_click")).toBe(true);
  });

  it("rejects unknown and non-string values", () => {
    expect(isAdEvent("page_view")).toBe(false);
    expect(isAdEvent("")).toBe(false);
    expect(isAdEvent(null)).toBe(false);
    expect(isAdEvent(42)).toBe(false);
  });

  it("keeps the allowlist to the two first-party ad events", () => {
    expect(AD_EVENTS).toEqual(["ad_impression", "ad_click"]);
  });
});

describe("sanitizeAdMetadata", () => {
  it("keeps only the placementId and only for known placements", () => {
    expect(sanitizeAdMetadata("ad_impression", { placementId: "jobs-list-top" })).toEqual({
      placementId: "jobs-list-top",
    });
    expect(
      sanitizeAdMetadata("ad_click", {
        placementId: "job-detail-sidebar",
        injected: "never stored",
      }),
    ).toEqual({ placementId: "job-detail-sidebar" });
  });

  it("drops unknown placement ids and extra keys", () => {
    expect(
      sanitizeAdMetadata("ad_impression", { placementId: "home-hero" }),
    ).toEqual({});
    expect(sanitizeAdMetadata("ad_impression", undefined)).toEqual({});
  });
});

describe("trackAdEvent", () => {
  it.each(AD_EVENTS)(
    "inserts %s with placementId metadata and null jobId",
    async (event) => {
      await trackAdEvent({ event, placementId: "jobs-list-top", locale: "en" });

      expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
      expect(mocks.mockValues).toHaveBeenCalledWith({
        event,
        jobId: null,
        locale: "en",
        metadata: { placementId: "jobs-list-top" },
      });
    },
  );

  it("rejects unknown event names without inserting", async () => {
    await trackAdEvent({
      event: "page_view" as AdEventName,
      placementId: "jobs-list-top",
    });

    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "UNKNOWN_AD_EVENT",
      event: "page_view",
    });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("rejects unknown placement ids without inserting", async () => {
    await trackAdEvent({
      event: "ad_impression",
      placementId: "home-hero",
    });

    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "INVALID_AD_PLACEMENT",
      placementId: "home-hero",
    });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("skips entirely when analytics is disabled", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");

    await trackAdEvent({ event: "ad_impression", placementId: "jobs-list-top" });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("skips entirely when monetization is disabled", async () => {
    vi.unstubAllEnvs();

    await trackAdEvent({ event: "ad_impression", placementId: "jobs-list-top" });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("never throws when the DB insert fails", async () => {
    mocks.mockValues.mockRejectedValue(new Error("db unavailable"));

    await expect(
      trackAdEvent({ event: "ad_impression", placementId: "job-detail-sidebar" }),
    ).resolves.toBeUndefined();

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({
        event: "ad_impression",
        errorCode: "CAPTURE_FAILED",
      }),
    );
  });

  it("resolves locale through the server when none is provided", async () => {
    mocks.mockGetCurrentLocale.mockResolvedValue("am");

    await trackAdEvent({ event: "ad_impression", placementId: "jobs-list-top" });

    expect(mocks.mockGetCurrentLocale).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "am" }),
    );
  });

  it("falls back to en when getCurrentLocale rejects", async () => {
    mocks.mockGetCurrentLocale.mockRejectedValue(new Error("no session"));

    await trackAdEvent({ event: "ad_click", placementId: "jobs-list-top" });

    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });
});