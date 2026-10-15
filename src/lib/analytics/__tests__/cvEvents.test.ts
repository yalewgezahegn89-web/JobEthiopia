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
  isCvEvent,
  trackCvEvent,
  CV_EVENTS,
  type CvEventName,
} from "../cvEvents";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockValues.mockResolvedValue(undefined);
  mocks.mockGetCurrentLocale.mockResolvedValue("en");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isCvEvent", () => {
  it("accepts all five valid event names", () => {
    expect(isCvEvent("cv_created")).toBe(true);
    expect(isCvEvent("cv_updated")).toBe(true);
    expect(isCvEvent("cv_previewed")).toBe(true);
    expect(isCvEvent("cv_downloaded")).toBe(true);
    expect(isCvEvent("cv_deleted")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isCvEvent("cv_opened")).toBe(false);
    expect(isCvEvent("job_search")).toBe(false);
    expect(isCvEvent("")).toBe(false);
    expect(isCvEvent("CV_CREATED")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isCvEvent(null)).toBe(false);
    expect(isCvEvent(undefined)).toBe(false);
    expect(isCvEvent(42)).toBe(false);
    expect(isCvEvent({})).toBe(false);
  });
});

describe("trackCvEvent", () => {
  it.each(CV_EVENTS)(
    "inserts %s with empty metadata and null jobId",
    async (event) => {
      await trackCvEvent({ event, locale: "en" });

      expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
      expect(mocks.mockValues).toHaveBeenCalledWith({
        event,
        jobId: null,
        locale: "en",
        metadata: {},
      });
    },
  );

  it("rejects unknown event names and logs a warning without inserting", async () => {
    await trackCvEvent({
      event: "cv_opened" as CvEventName,
    });

    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "UNKNOWN_CV_EVENT",
      event: "cv_opened",
    });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("skips entirely when ANALYTICS_ENABLED is false", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");

    await trackCvEvent({ event: "cv_created" });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("never throws when the DB insert fails", async () => {
    mocks.mockValues.mockRejectedValue(new Error("db unavailable"));

    await expect(
      trackCvEvent({ event: "cv_deleted", locale: "am" }),
    ).resolves.toBeUndefined();

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({
        event: "cv_deleted",
        errorCode: "CAPTURE_FAILED",
      }),
    );
  });

  it("logs error with stringified non-Error throw", async () => {
    mocks.mockValues.mockRejectedValue("raw string failure");

    await trackCvEvent({ event: "cv_updated", locale: "en" });

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({
        event: "cv_updated",
        reason: "UNKNOWN",
      }),
    );
  });

  it("resolves locale via lazy import when none is provided", async () => {
    mocks.mockGetCurrentLocale.mockResolvedValue("am");

    await trackCvEvent({ event: "cv_created" });

    expect(mocks.mockGetCurrentLocale).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "am" }),
    );
  });

  it("falls back to en when getCurrentLocale rejects", async () => {
    mocks.mockGetCurrentLocale.mockRejectedValue(new Error("no session"));

    await trackCvEvent({ event: "cv_previewed" });

    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });

  it("uses provided locale even when getCurrentLocale would resolve differently", async () => {
    mocks.mockGetCurrentLocale.mockResolvedValue("om");

    await trackCvEvent({ event: "cv_downloaded", locale: "om" });

    expect(mocks.mockGetCurrentLocale).not.toHaveBeenCalled();
    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "om" }),
    );
  });

  it("returns undefined on success", async () => {
    const result = await trackCvEvent({ event: "cv_created", locale: "en" });
    expect(result).toBeUndefined();
  });
});
