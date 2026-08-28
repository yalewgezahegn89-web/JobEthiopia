import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../ingest", () => ({
  ingestJob: vi.fn(),
}));

vi.mock("../../sources", () => ({
  recordSuccessfulCheck: vi.fn(),
}));

import { ingestJobs } from "../batch";
import { ingestJob } from "../ingest";
import { recordSuccessfulCheck } from "../../sources";
import type { RawJobInput } from "../types";

const mockIngestJob = vi.mocked(ingestJob);
const mockRecordSuccessfulCheck = vi.mocked(recordSuccessfulCheck);

const makeJob = (overrides: Partial<RawJobInput> = {}): RawJobInput => ({
  title: "Staff Nurse",
  description: "Nursing role",
  organizationName: "Black Lion Hospital",
  sourceId: "source-1",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRecordSuccessfulCheck.mockResolvedValue({
    sourceId: "source-1",
    lastSuccessfulCheck: new Date(),
    lastAttemptedCheck: new Date(),
    lastError: null,
    checkFrequencyMinutes: null,
    consecutiveFailures: 0,
  });
});

describe("ingestJobs", () => {
  describe("empty batch", () => {
    it("returns zero summary for empty jobs array", async () => {
      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [],
      });

      expect(result.summary.total).toBe(0);
      expect(result.summary.created).toBe(0);
      expect(result.summary.failed).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(mockRecordSuccessfulCheck).toHaveBeenCalledWith("source-1");
    });
  });

  describe("single job", () => {
    it("processes a single job successfully", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "CREATED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
      });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(result.summary.total).toBe(1);
      expect(result.summary.created).toBe(1);
      expect(result.items[0].outcome).toBe("CREATED");
      expect(result.items[0].error).toBeNull();
    });

    it("injects sourceId into each job", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "CREATED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
      });

      await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob({ sourceId: "wrong-source" })],
      });

      expect(mockIngestJob).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: "source-1" }),
      );
    });
  });

  describe("multiple jobs", () => {
    it("processes multiple jobs and counts outcomes", async () => {
      mockIngestJob
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-1",
          jobSourceId: "js-1",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        })
        .mockResolvedValueOnce({
          outcome: "DUPLICATE",
          jobId: null,
          jobSourceId: null,
          matchedJobId: "job-2",
          matchedJobSourceId: "js-2",
          duplicateLevel: "SOURCE_IDENTIFIER",
          duplicateConfidence: 1.0,
          duplicateReason: "Match",
        })
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-3",
          jobSourceId: "js-3",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob(), makeJob(), makeJob()],
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.created).toBe(2);
      expect(result.summary.duplicate).toBe(1);
      expect(result.items).toHaveLength(3);
    });

    it("preserves input order in results", async () => {
      mockIngestJob
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-1",
          jobSourceId: "js-1",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        })
        .mockResolvedValueOnce({
          outcome: "DUPLICATE",
          jobId: null,
          jobSourceId: null,
          matchedJobId: "job-2",
          matchedJobSourceId: "js-2",
          duplicateLevel: "SOURCE_IDENTIFIER",
          duplicateConfidence: 1.0,
          duplicateReason: "Match",
        });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob(), makeJob()],
      });

      expect(result.items[0].index).toBe(0);
      expect(result.items[0].outcome).toBe("CREATED");
      expect(result.items[1].index).toBe(1);
      expect(result.items[1].outcome).toBe("DUPLICATE");
    });
  });

  describe("error isolation", () => {
    it("isolates errors per item", async () => {
      mockIngestJob
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-1",
          jobSourceId: "js-1",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        })
        .mockRejectedValueOnce(new Error("DB failure"))
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-3",
          jobSourceId: "js-3",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob(), makeJob(), makeJob()],
      });

      expect(result.summary.total).toBe(3);
      expect(result.summary.created).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.items[1].error).toBe("DB failure");
      expect(result.items[1].outcome).toBe("CREATED");
      expect(result.items[1].jobId).toBeNull();
    });

    it("continues processing after failure", async () => {
      mockIngestJob
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce({
          outcome: "CREATED",
          jobId: "job-2",
          jobSourceId: "js-2",
          matchedJobId: null,
          matchedJobSourceId: null,
          duplicateLevel: null,
          duplicateConfidence: null,
          duplicateReason: null,
        });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob(), makeJob()],
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].error).toBe("First failure");
      expect(result.items[1].error).toBeNull();
      expect(result.items[1].outcome).toBe("CREATED");
    });

    it("handles non-Error thrown values", async () => {
      mockIngestJob.mockRejectedValueOnce("string error");

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(result.items[0].error).toBe("string error");
    });
  });

  describe("outcome counting", () => {
    it("counts LINKED outcomes", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "LINKED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: "existing-job",
        matchedJobSourceId: null,
        duplicateLevel: "ORG_TITLE_LOCATION",
        duplicateConfidence: 0.8,
        duplicateReason: "Match",
      });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(result.summary.linked).toBe(1);
    });

    it("counts UPDATED outcomes", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "UPDATED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        duplicateLevel: "CONTENT_HASH",
        duplicateConfidence: 0.95,
        duplicateReason: "Hash match",
      });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(result.summary.updated).toBe(1);
    });

    it("counts POSSIBLE_DUPLICATE outcomes", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "POSSIBLE_DUPLICATE",
        jobId: null,
        jobSourceId: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: 0.5,
        duplicateReason: "Uncertain",
      });

      const result = await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(result.summary.possibleDuplicate).toBe(1);
    });
  });

  describe("source health", () => {
    it("calls recordSuccessfulCheck after batch completes", async () => {
      mockIngestJob.mockResolvedValue({
        outcome: "CREATED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
      });

      await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(mockRecordSuccessfulCheck).toHaveBeenCalledWith("source-1");
    });

    it("calls recordSuccessfulCheck even when items fail", async () => {
      mockIngestJob.mockRejectedValue(new Error("failure"));

      await ingestJobs({
        sourceId: "source-1",
        jobs: [makeJob()],
      });

      expect(mockRecordSuccessfulCheck).toHaveBeenCalledWith("source-1");
    });

    it("calls recordSuccessfulCheck for empty batch", async () => {
      await ingestJobs({
        sourceId: "source-1",
        jobs: [],
      });

      expect(mockRecordSuccessfulCheck).toHaveBeenCalledWith("source-1");
    });
  });
});
