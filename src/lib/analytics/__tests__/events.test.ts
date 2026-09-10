import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
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

import {
  trackDiscoveryEvent,
  classifyJobListEvent,
  buildJobSearchMetadata,
  sanitizeMetadata,
  type DiscoveryEventName,
} from "../events";

const JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockValues.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("trackDiscoveryEvent", () => {
  it("records an allowlisted event with sanitized metadata and locale", async () => {
    await trackDiscoveryEvent({
      event: "job_search",
      locale: "am",
      metadata: {
        hasQuery: true,
        resultCount: 7,
        page: 2,
        injectedFromClient: "should never be stored",
      },
    });

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "job_search",
      jobId: null,
      locale: "am",
      metadata: { hasQuery: true, resultCount: 7, page: 2 },
    });
  });

  it("stores the job id only for well-formed uuids on job_viewed", async () => {
    await trackDiscoveryEvent({
      event: "job_viewed",
      jobId: JOB_ID,
      locale: "en",
    });
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "job_viewed",
      jobId: JOB_ID,
      locale: "en",
      metadata: {},
    });
  });

  it("drops a malformed job id", async () => {
    await trackDiscoveryEvent({
      event: "job_viewed",
      jobId: "not-a-uuid",
      locale: "en",
    });
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "job_viewed",
      jobId: null,
      locale: "en",
      metadata: {},
    });
  });

  it("coerces an unsupported locale to the default locale", async () => {
    await trackDiscoveryEvent({
      event: "job_list_viewed",
      locale: "xx",
    });
    expect(mocks.mockValues).toHaveBeenCalledWith({
      event: "job_list_viewed",
      jobId: null,
      locale: "en",
      metadata: {},
    });
  });

  it("rejects unknown events without writing and without throwing", async () => {
    await expect(
      trackDiscoveryEvent({ event: "STOLEN_CREDENTIALS" as DiscoveryEventName }),
    ).resolves.toBeUndefined();
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("skips capture when analytics is disabled via env", async () => {
    vi.stubEnv("ANALYTICS_ENABLED", "false");
    await trackDiscoveryEvent({ event: "job_search", locale: "en" });
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it("never throws when the storage insert fails", async () => {
    mocks.mockValues.mockRejectedValue(new Error("db unavailable"));
    await expect(
      trackDiscoveryEvent({
        event: "job_viewed",
        jobId: JOB_ID,
        locale: "om",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("sanitizeMetadata", () => {
  it("drops non-primitive and non-finite values", () => {
    const result = sanitizeMetadata("job_search", {
      hasQuery: {} as unknown,
      resultCount: Number.POSITIVE_INFINITY,
      page: 3,
      hasCategory: false,
    });
    expect(result).toEqual({ page: 3, hasCategory: false });
  });

  it("is an allowlist: every stored key belongs to the event", () => {
    const result = sanitizeMetadata("job_viewed", {
      hasQuery: true,
      page: 5,
      someRandomKey: "x",
    });
    expect(result).toEqual({});
  });
});

describe("classifyJobListEvent", () => {
  it("classifies a plain browse as list view", () => {
    expect(classifyJobListEvent({})).toBe("job_list_viewed");
  });

  it("classifies any query or filter as search", () => {
    expect(classifyJobListEvent({ q: "engineer" })).toBe("job_search");
    expect(classifyJobListEvent({ categoryId: "cat-1" })).toBe("job_search");
    expect(classifyJobListEvent({ professionId: "prof-1" })).toBe("job_search");
    expect(classifyJobListEvent({ locationId: "loc-1" })).toBe("job_search");
    expect(classifyJobListEvent({ employmentType: "FULL_TIME" })).toBe(
      "job_search",
    );
    expect(classifyJobListEvent({ organizationId: "org-1" })).toBe("job_search");
  });
});

describe("buildJobSearchMetadata", () => {
  it("builds bounded presence flags and coerced counts", () => {
    expect(
      buildJobSearchMetadata({
        q: "senior",
        categoryId: "cat-1",
        resultCount: 12,
        page: 2,
      }),
    ).toEqual({
      hasQuery: true,
      hasCategory: true,
      hasProfession: false,
      hasLocation: false,
      hasEmploymentType: false,
      hasOrganization: false,
      resultCount: 12,
      page: 2,
    });
  });

  it("sanitizes negative and non-numeric counts", () => {
    expect(buildJobSearchMetadata({ resultCount: -4 }).resultCount).toBe(0);
    expect(buildJobSearchMetadata({ resultCount: Number.POSITIVE_INFINITY }).resultCount).toBe(0);
    expect(buildJobSearchMetadata({ page: 0 }).page).toBe(1);
  });
});