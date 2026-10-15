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
  PAGE_EVENTS,
  PAGE_VIEW_PATHS,
  isPageEvent,
  isPageViewPath,
  resolvePageViewPath,
  sanitizePageMetadata,
  trackPageView,
} from "../pageEvents";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockValues.mockResolvedValue(undefined);
  mocks.mockGetCurrentLocale.mockResolvedValue("en");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PAGE_VIEW_PATHS", () => {
  it("contains only public and career tool route patterns", () => {
    expect(PAGE_VIEW_PATHS).toEqual([
      "/",
      "/careers",
      "/careers/[id]",
      "/cv",
      "/cover-letter",
      "/interview-prep",
    ]);
  });

  it("never exposes concrete ids or slugs", () => {
    for (const path of PAGE_VIEW_PATHS) {
      expect(path).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
      expect(path.includes("?")).toBe(false);
      expect(path.includes("#")).toBe(false);
    }
  });
});

describe("isPageEvent / isPageViewPath", () => {
  it("accepts the page_viewed event", () => {
    expect(isPageEvent("page_viewed")).toBe(true);
    expect(PAGE_EVENTS).toEqual(["page_viewed"]);
  });

  it("rejects unknown events", () => {
    expect(isPageEvent("job_search")).toBe(false);
    expect(isPageEvent("")).toBe(false);
    expect(isPageEvent(null)).toBe(false);
  });

  it("accepts allowlisted paths only", () => {
    expect(isPageViewPath("/cv")).toBe(true);
    expect(isPageViewPath("/admin")).toBe(false);
    expect(isPageViewPath("/careers/secret")).toBe(false);
    expect(isPageViewPath(undefined)).toBe(false);
  });
});

describe("resolvePageViewPath", () => {
  it("keeps allowlisted paths as-is", () => {
    expect(resolvePageViewPath("/")).toBe("/");
    expect(resolvePageViewPath("/careers")).toBe("/careers");
    expect(resolvePageViewPath("/cv")).toBe("/cv");
    expect(resolvePageViewPath("/cover-letter")).toBe("/cover-letter");
    expect(resolvePageViewPath("/interview-prep")).toBe("/interview-prep");
  });

  it("collapses every article detail route onto a pattern", () => {
    expect(resolvePageViewPath("/careers/how-to-write-a-cv")).toBe(
      "/careers/[id]",
    );
    expect(resolvePageViewPath("/careers/anything/else")).toBe(
      "/careers/[id]",
    );
  });

  it("treats trailing slashes as the canonical path", () => {
    expect(resolvePageViewPath("/careers/")).toBe("/careers");
    expect(resolvePageViewPath("/cv/")).toBe("/cv");
  });

  it("rejects every non allowlisted route", () => {
    expect(resolvePageViewPath("/jobs")).toBeNull();
    expect(resolvePageViewPath("/admin/analytics")).toBeNull();
    expect(resolvePageViewPath("/cv/edit")).toBeNull();
    expect(resolvePageViewPath("")).toBeNull();
  });
});

describe("sanitizePageMetadata", () => {
  it("keeps the path only", () => {
    expect(
      sanitizePageMetadata("page_viewed", {
        path: "/cv",
        userId: "user-1",
        email: "a@b.c",
        slug: "secret",
      }),
    ).toEqual({ path: "/cv" });
  });

  it("drops missing values and bounds long strings", () => {
    expect(sanitizePageMetadata("page_viewed", undefined)).toEqual({});
    expect(sanitizePageMetadata("page_viewed", {})).toEqual({});
    expect(
      sanitizePageMetadata("page_viewed", { path: "x".repeat(200) }),
    ).toEqual({ path: "x".repeat(64) });
  });
});

describe("trackPageView", () => {
  it("inserts an allowlisted page view with the resolved locale", async () => {
    await trackPageView({ pathname: "/", locale: "am" });

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "page_viewed",
      locale: "am",
      metadata: { path: "/" },
    });
  });

  it("resolves the locale lazily when none is provided", async () => {
    mocks.mockGetCurrentLocale.mockResolvedValue("om");

    await trackPageView({ pathname: "/careers/how-to-write-a-cv" });

    expect(mocks.mockGetCurrentLocale).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "om", metadata: { path: "/careers/[id]" } }),
    );
  });

  it("falls back to en when locale resolution fails", async () => {
    mocks.mockGetCurrentLocale.mockRejectedValue(new Error("no session"));

    await trackPageView({ pathname: "/cv" });

    expect(mocks.mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" }),
    );
  });

  it("refuses paths outside the allowlist without inserting", async () => {
    await trackPageView({ pathname: "/admin" });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mocks.mockLogWarn).toHaveBeenCalledWith("analytics_event_rejected", {
      reason: "PATH_NOT_ALLOWLISTED",
      event: "page_viewed",
    });
  });

  it("skips entirely when analytics is disabled", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");

    await trackPageView({ pathname: "/" });

    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("never throws when the insert fails", async () => {
    mocks.mockValues.mockRejectedValue(new Error("db unavailable"));

    await expect(
      trackPageView({ pathname: "/interview-prep" }),
    ).resolves.toBeUndefined();

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({
        event: "page_viewed",
        errorCode: "CAPTURE_FAILED",
      }),
    );
  });

  it("logs stringified non-Error failures with an UNKNOWN reason", async () => {
    mocks.mockValues.mockRejectedValue("raw failure");

    await trackPageView({ pathname: "/" });

    expect(mocks.mockLogError).toHaveBeenCalledWith(
      "analytics_event_capture_failed",
      expect.objectContaining({ reason: "UNKNOWN" }),
    );
  });

  it("returns undefined on success", async () => {
    const result = await trackPageView({ pathname: "/cv" });
    expect(result).toBeUndefined();
  });
});
