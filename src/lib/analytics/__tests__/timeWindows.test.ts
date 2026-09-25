import { describe, it, expect } from "vitest";
import {
  ANALYTICS_WINDOW_IDS,
  ANALYTICS_WINDOWS,
  DEFAULT_ANALYTICS_WINDOW_ID,
  getAnalyticsWindow,
  isAnalyticsWindowId,
  parseAnalyticsWindowId,
  windowStart,
} from "../timeWindows";

describe("window registry", () => {
  it("exposes exactly four bounded windows", () => {
    expect(ANALYTICS_WINDOW_IDS).toEqual(["1d", "7d", "30d", "90d"]);
  });

  it("defines a window for every id", () => {
    for (const id of ANALYTICS_WINDOW_IDS) {
      expect(ANALYTICS_WINDOWS[id].id).toBe(id);
      expect(ANALYTICS_WINDOWS[id].days).toBeGreaterThan(0);
      expect(ANALYTICS_WINDOWS[id].trendPoints).toBeGreaterThan(0);
    }
  });

  it("defaults to the 30 day window", () => {
    expect(DEFAULT_ANALYTICS_WINDOW_ID).toBe("30d");
    expect(getAnalyticsWindow().id).toBe("30d");
  });

  it("trends hourly for the 24 hour window and daily otherwise", () => {
    expect(ANALYTICS_WINDOWS["1d"]).toEqual({
      id: "1d",
      days: 1,
      trendPoints: 24,
      trendUnit: "hour",
    });
    expect(ANALYTICS_WINDOWS["7d"].trendUnit).toBe("day");
    expect(ANALYTICS_WINDOWS["7d"].trendPoints).toBe(7);
    expect(ANALYTICS_WINDOWS["30d"].trendPoints).toBe(14);
    expect(ANALYTICS_WINDOWS["90d"].trendPoints).toBe(14);
  });

  it("never exceeds 24 trend points for any window", () => {
    for (const id of ANALYTICS_WINDOW_IDS) {
      expect(ANALYTICS_WINDOWS[id].trendPoints).toBeLessThanOrEqual(24);
    }
  });
});

describe("isAnalyticsWindowId", () => {
  it("accepts supported ids", () => {
    for (const id of ANALYTICS_WINDOW_IDS) {
      expect(isAnalyticsWindowId(id)).toBe(true);
    }
  });

  it("rejects unsupported values", () => {
    expect(isAnalyticsWindowId("forever")).toBe(false);
    expect(isAnalyticsWindowId("")).toBe(false);
    expect(isAnalyticsWindowId(null)).toBe(false);
    expect(isAnalyticsWindowId(undefined)).toBe(false);
    expect(isAnalyticsWindowId(30)).toBe(false);
    expect(isAnalyticsWindowId({})).toBe(false);
  });
});

describe("parseAnalyticsWindowId", () => {
  it("keeps supported ids", () => {
    expect(parseAnalyticsWindowId("90d")).toBe("90d");
  });

  it("falls back to the default for anything else", () => {
    expect(parseAnalyticsWindowId("10y")).toBe(DEFAULT_ANALYTICS_WINDOW_ID);
    expect(parseAnalyticsWindowId(undefined)).toBe(DEFAULT_ANALYTICS_WINDOW_ID);
    expect(parseAnalyticsWindowId(null)).toBe(DEFAULT_ANALYTICS_WINDOW_ID);
    expect(parseAnalyticsWindowId(7)).toBe(DEFAULT_ANALYTICS_WINDOW_ID);
    expect(parseAnalyticsWindowId({ window: "1d" })).toBe(
      DEFAULT_ANALYTICS_WINDOW_ID,
    );
  });

  it("uses the first entry of request-style array values", () => {
    expect(parseAnalyticsWindowId(["7d", "90d"])).toBe("7d");
    expect(parseAnalyticsWindowId(["bogus"])).toBe(DEFAULT_ANALYTICS_WINDOW_ID);
  });
});

describe("getAnalyticsWindow", () => {
  it("normalizes raw request input", () => {
    expect(getAnalyticsWindow("7d").days).toBe(7);
    expect(getAnalyticsWindow("bogus").id).toBe("30d");
    expect(getAnalyticsWindow(["1d"]).id).toBe("1d");
  });
});

describe("windowStart", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("subtracts the window days from now", () => {
    expect(windowStart(getAnalyticsWindow("1d"), now).toISOString()).toBe(
      "2026-06-14T12:00:00.000Z",
    );
    expect(windowStart(getAnalyticsWindow("7d"), now).toISOString()).toBe(
      "2026-06-08T12:00:00.000Z",
    );
    expect(windowStart(getAnalyticsWindow("30d"), now).toISOString()).toBe(
      "2026-05-16T12:00:00.000Z",
    );
    expect(windowStart(getAnalyticsWindow("90d"), now).toISOString()).toBe(
      "2026-03-17T12:00:00.000Z",
    );
  });
});
