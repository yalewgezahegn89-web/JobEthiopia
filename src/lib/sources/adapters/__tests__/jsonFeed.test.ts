import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSsrfFetch: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: (...args: unknown[]) => mocks.mockSsrfFetch(...args),
}));

import { JsonFeedAdapter } from "../jsonFeed";

const SOURCE = {
  id: "11111111-1111-4111-8111-111111111111",
  baseUrl: "https://feeds.example.com/jobs.json",
  name: "Example Feed",
};

const VALID_ITEM = {
  title: "Software Engineer",
  description: "Build great software.",
  organizationName: "Acme Ltd",
  locationName: "Addis Ababa",
  externalId: "acme-123",
  sourceUrl: "https://example.com/jobs/acme-123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFindFirst.mockResolvedValue(SOURCE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("JsonFeedAdapter", () => {
  const adapter = new JsonFeedAdapter();

  it("returns Source not found when the source does not exist", async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({ success: false, error: "Source not found" });
  });

  it("returns an error when the source has no base URL", async () => {
    mocks.mockFindFirst.mockResolvedValue({ ...SOURCE, baseUrl: null });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({
      success: false,
      error: "Source has no base URL configured",
    });
    expect(mocks.mockSsrfFetch).not.toHaveBeenCalled();
  });

  it("performs a bounded SSRF-safe GET request against the base URL", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: "[]",
    });
    await adapter.fetchJobs(SOURCE.id);
    expect(mocks.mockSsrfFetch).toHaveBeenCalledWith(SOURCE.baseUrl, {
      method: "GET",
      maxBytes: 4 * 1024 * 1024,
    });
  });

  it("returns an error when the HTTP status is not ok", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({ ok: false, status: 503 });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({ success: false, error: "HTTP 503" });
  });

  it("returns an error when ssrfFetch throws", async () => {
    mocks.mockSsrfFetch.mockRejectedValue(new Error("Connection refused"));
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({ success: false, error: "Connection refused" });
  });

  it("returns an error when the response is not valid JSON", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({ ok: true, status: 200, text: "<html>" });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({ success: false, error: "Invalid JSON response" });
  });

  it("returns an error when the feed root is not an array", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify({ items: [] }),
    });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({
      success: false,
      error: "Feed root must be a JSON array",
    });
  });

  it("maps valid records to RawJobInput with the source ID injected", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify([VALID_ITEM]),
    });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toEqual([{ ...VALID_ITEM, sourceId: SOURCE.id }]);
    }
  });

  it("returns success with an empty list for an empty feed", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify([]),
    });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result).toEqual({ success: true, jobs: [] });
  });

  it("skips malformed records without failing the fetch", async () => {
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify([
        VALID_ITEM,
        { title: "Missing description and org" },
        { ...VALID_ITEM, externalId: "acme-456" },
      ]),
    });
    const result = await adapter.fetchJobs(SOURCE.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs.map((j) => j.externalId)).toEqual(["acme-123", "acme-456"]);
    }
  });

  it("bounds the number of processed records", async () => {
    const bounded = new JsonFeedAdapter(2);
    mocks.mockSsrfFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: JSON.stringify([
        { ...VALID_ITEM, externalId: "a" },
        { ...VALID_ITEM, externalId: "b" },
        { ...VALID_ITEM, externalId: "c" },
      ]),
    });
    const result = await bounded.fetchJobs(SOURCE.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.jobs).toHaveLength(2);
    }
  });
});