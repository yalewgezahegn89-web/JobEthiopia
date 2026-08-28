import { describe, it, expect, vi, beforeEach } from "vitest";

const mockJobSourcesFindFirst = vi.fn();
const mockJobsFindFirst = vi.fn();

vi.mock("../../../db", () => ({
  db: {
    query: {
      jobSources: { findFirst: (...args: unknown[]) => mockJobSourcesFindFirst(...args) },
      jobs: { findFirst: (...args: unknown[]) => mockJobsFindFirst(...args) },
    },
  },
}));

import { detectDuplicate } from "../index";

beforeEach(() => {
  mockJobSourcesFindFirst.mockReset();
  mockJobsFindFirst.mockReset();
});

const baseInput = {
  sourceId: "source-1",
  externalId: null,
  sourceUrl: null,
  rawHash: null,
  organizationId: "org-1",
  normalizedTitle: "Nurse",
  locationId: "loc-1",
};

describe("detectDuplicate", () => {
  describe("Level 1 — SOURCE_IDENTIFIER", () => {
    it("returns DUPLICATE when externalId matches", async () => {
      mockJobSourcesFindFirst.mockResolvedValueOnce({ id: "js-1", jobId: "job-1" });

      const result = await detectDuplicate({
        ...baseInput,
        externalId: "ext-123",
      });

      expect(result.classification).toBe("DUPLICATE");
      expect(result.level).toBe("SOURCE_IDENTIFIER");
      expect(result.matchedJobId).toBe("job-1");
      expect(result.matchedJobSourceId).toBe("js-1");
      expect(result.confidence).toBe(1.0);
    });

    it("skips L1 when externalId is null", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        externalId: null,
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).not.toHaveBeenCalled();
    });

    it("skips L1 when externalId is empty string", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        externalId: "  ",
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("Level 2 — SOURCE_URL", () => {
    it("returns DUPLICATE when sourceUrl matches", async () => {
      // L1 is skipped (externalId is null), so only L2 mock needed
      mockJobSourcesFindFirst.mockResolvedValueOnce({ id: "js-2", jobId: "job-2" });

      const result = await detectDuplicate({
        ...baseInput,
        sourceUrl: "https://example.com/job/123/",
      });

      expect(result.classification).toBe("DUPLICATE");
      expect(result.level).toBe("SOURCE_URL");
      expect(result.matchedJobId).toBe("job-2");
      expect(result.matchedJobSourceId).toBe("js-2");
      expect(result.confidence).toBe(0.99);
    });

    it("skips L2 when sourceUrl is null", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        sourceUrl: null,
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("Level 3 — CONTENT_HASH", () => {
    it("returns DUPLICATE when rawHash matches", async () => {
      // L1 and L2 are skipped (externalId and sourceUrl are null)
      mockJobSourcesFindFirst.mockResolvedValueOnce({ id: "js-3", jobId: "job-3" });

      const result = await detectDuplicate({
        ...baseInput,
        rawHash: "abc123hash",
      });

      expect(result.classification).toBe("DUPLICATE");
      expect(result.level).toBe("CONTENT_HASH");
      expect(result.matchedJobId).toBe("job-3");
      expect(result.matchedJobSourceId).toBe("js-3");
      expect(result.confidence).toBe(0.95);
    });

    it("skips L3 when rawHash is null", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        rawHash: null,
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).not.toHaveBeenCalled();
    });

    it("skips L3 when rawHash is empty string", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        rawHash: "  ",
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("Level 4 — ORG_TITLE_LOCATION", () => {
    it("returns POSSIBLE_DUPLICATE when org+title+location match", async () => {
      // L1, L2, L3 are all skipped
      mockJobsFindFirst.mockResolvedValueOnce({ id: "job-4" });

      const result = await detectDuplicate({
        ...baseInput,
        normalizedTitle: "Nurse",
        locationId: "loc-1",
      });

      expect(result.classification).toBe("POSSIBLE_DUPLICATE");
      expect(result.level).toBe("ORG_TITLE_LOCATION");
      expect(result.matchedJobId).toBe("job-4");
      expect(result.matchedJobSourceId).toBeNull();
      expect(result.confidence).toBe(0.8);
    });

    it("skips L4 when normalizedTitle is empty", async () => {
      const result = await detectDuplicate({
        ...baseInput,
        normalizedTitle: "",
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobsFindFirst).not.toHaveBeenCalled();
    });

    it("handles null locationId (queries for NULL locationId)", async () => {
      mockJobsFindFirst.mockResolvedValueOnce({ id: "job-5" });

      const result = await detectDuplicate({
        ...baseInput,
        locationId: null,
      });

      expect(result.classification).toBe("POSSIBLE_DUPLICATE");
      expect(result.level).toBe("ORG_TITLE_LOCATION");
    });
  });

  describe("Cascade order", () => {
    it("returns L1 match without checking L2/L3/L4", async () => {
      mockJobSourcesFindFirst.mockResolvedValueOnce({ id: "js-1", jobId: "job-1" });

      const result = await detectDuplicate({
        ...baseInput,
        externalId: "ext-1",
        sourceUrl: "https://example.com/job/",
        rawHash: "hash1",
        normalizedTitle: "Nurse",
      });

      expect(result.level).toBe("SOURCE_IDENTIFIER");
      expect(mockJobSourcesFindFirst).toHaveBeenCalledTimes(1);
      expect(mockJobsFindFirst).not.toHaveBeenCalled();
    });

    it("returns L2 match without checking L3/L4", async () => {
      // L1 has externalId but no match → 1 call returning null
      // L2 has sourceUrl → 1 call returning match
      mockJobSourcesFindFirst
        .mockResolvedValueOnce(null) // L1 no match
        .mockResolvedValueOnce({ id: "js-2", jobId: "job-2" }); // L2 match

      const result = await detectDuplicate({
        ...baseInput,
        externalId: "ext-1",
        sourceUrl: "https://example.com/job/",
        rawHash: "hash1",
        normalizedTitle: "Nurse",
      });

      expect(result.level).toBe("SOURCE_URL");
      expect(mockJobSourcesFindFirst).toHaveBeenCalledTimes(2);
      expect(mockJobsFindFirst).not.toHaveBeenCalled();
    });

    it("returns L3 match without checking L4", async () => {
      // L1 has externalId but no match → 1 call returning null
      // L2 has sourceUrl but no match → 1 call returning null
      // L3 has rawHash → 1 call returning match
      mockJobSourcesFindFirst
        .mockResolvedValueOnce(null) // L1 no match
        .mockResolvedValueOnce(null) // L2 no match
        .mockResolvedValueOnce({ id: "js-3", jobId: "job-3" }); // L3 match

      const result = await detectDuplicate({
        ...baseInput,
        externalId: "ext-1",
        sourceUrl: "https://example.com/job/",
        rawHash: "hash1",
        normalizedTitle: "Nurse",
      });

      expect(result.level).toBe("CONTENT_HASH");
      expect(mockJobSourcesFindFirst).toHaveBeenCalledTimes(3);
      expect(mockJobsFindFirst).not.toHaveBeenCalled();
    });

    it("checks all 4 levels when no match at earlier levels", async () => {
      mockJobSourcesFindFirst.mockResolvedValue(null);
      mockJobsFindFirst.mockResolvedValue(null);

      const result = await detectDuplicate({
        ...baseInput,
        externalId: "ext-1",
        sourceUrl: "https://example.com/job/",
        rawHash: "hash1",
        normalizedTitle: "Nurse",
      });

      expect(result.classification).toBe("UNIQUE");
      expect(mockJobSourcesFindFirst).toHaveBeenCalledTimes(3);
      expect(mockJobsFindFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("No match", () => {
    it("returns UNIQUE when no level matches", async () => {
      const result = await detectDuplicate(baseInput);

      expect(result.classification).toBe("UNIQUE");
      expect(result.level).toBeNull();
      expect(result.matchedJobId).toBeNull();
      expect(result.matchedJobSourceId).toBeNull();
      expect(result.confidence).toBe(1.0);
    });
  });
});

describe("canonicalUrl behavior within detectDuplicate", () => {
  it("canonicalizes sourceUrl before L2 lookup", async () => {
    // L1 has externalId but no match → 1 call returning null
    // L2 has sourceUrl → 1 call returning match
    mockJobSourcesFindFirst
      .mockResolvedValueOnce(null) // L1 no match
      .mockResolvedValueOnce({ id: "js-2", jobId: "job-2" }); // L2 match

    const result = await detectDuplicate({
      ...baseInput,
      externalId: "ext-1",
      sourceUrl: "https://EXAMPLE.com/job/123/",
    });

    expect(result.level).toBe("SOURCE_URL");
    expect(mockJobSourcesFindFirst).toHaveBeenCalledTimes(2);
  });
});
