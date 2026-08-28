import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../../db", () => ({
  db: {
    update: () => mockDbUpdate(),
    query: {
      organizations: { findFirst: vi.fn().mockResolvedValue(null) },
      locations: { findFirst: vi.fn().mockResolvedValue(null) },
      professions: { findFirst: vi.fn().mockResolvedValue(null) },
      categories: { findFirst: vi.fn().mockResolvedValue(null) },
      jobSources: { findFirst: vi.fn().mockResolvedValue(null) },
      jobs: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}));

vi.mock("../../validations/rawJobInput", () => ({
  validateRawJobInput: vi.fn(),
}));

vi.mock("../../dedup", () => ({
  detectDuplicate: vi.fn(),
}));

vi.mock("../resolveEntities", () => ({
  resolveOrganization: vi.fn(),
  resolveLocation: vi.fn(),
  resolveProfession: vi.fn(),
  resolveCategory: vi.fn(),
}));

vi.mock("../upsertJob", () => ({
  upsertJob: vi.fn(),
}));

vi.mock("../updateJob", () => ({
  updateJob: vi.fn(),
  getStoredHash: vi.fn(),
  contentChanged: vi.fn(),
}));

vi.mock("../createJobSource", () => ({
  createJobSource: vi.fn(),
}));

vi.mock("../updateLastSeenAt", () => ({
  updateLastSeenAt: vi.fn(),
}));

vi.mock("../../normalization/hash", () => ({
  computeContentHash: vi.fn(() => "mock-hash-123"),
}));

import { ingestJob } from "../ingest";
import { validateRawJobInput } from "../../validations/rawJobInput";
import { detectDuplicate } from "../../dedup";
import {
  resolveOrganization,
  resolveLocation,
  resolveProfession,
  resolveCategory,
} from "../resolveEntities";
import { upsertJob } from "../upsertJob";
import { updateJob, getStoredHash, contentChanged } from "../updateJob";
import { createJobSource } from "../createJobSource";
import { updateLastSeenAt } from "../updateLastSeenAt";

const mockValidate = vi.mocked(validateRawJobInput);
const mockDetectDuplicate = vi.mocked(detectDuplicate);
const mockResolveOrg = vi.mocked(resolveOrganization);
const mockResolveLocation = vi.mocked(resolveLocation);
const mockResolveProfession = vi.mocked(resolveProfession);
const mockResolveCategory = vi.mocked(resolveCategory);
const mockUpsertJob = vi.mocked(upsertJob);
const mockUpdateJob = vi.mocked(updateJob);
const mockGetStoredHash = vi.mocked(getStoredHash);
const mockContentChanged = vi.mocked(contentChanged);
const mockCreateJobSource = vi.mocked(createJobSource);
const mockUpdateLastSeenAt = vi.mocked(updateLastSeenAt);

const validInput = {
  title: "Staff Nurse",
  description: "Nursing role at hospital",
  organizationName: "Black Lion Hospital",
  sourceId: "source-1",
  locationName: "Addis Ababa",
  professionName: "Nursing",
  categoryName: "Healthcare",
  employmentType: "FULL_TIME",
  salaryRaw: "ETB 5000-8000 monthly",
  experienceRaw: "3-5 years",
};

beforeEach(() => {
  vi.clearAllMocks();

  mockValidate.mockReturnValue({ success: true, data: validInput as never });
  mockResolveOrg.mockResolvedValue("org-1");
  mockResolveLocation.mockResolvedValue("loc-1");
  mockResolveProfession.mockResolvedValue("prof-1");
  mockResolveCategory.mockResolvedValue("cat-1");
  mockUpsertJob.mockResolvedValue({ jobId: "job-1", jobSourceId: "js-1" });
});

describe("ingestJob", () => {
  describe("validation failure", () => {
    it("throws when validation fails", async () => {
      mockValidate.mockReturnValue({
        success: false,
        error: "title: Title is required",
      });

      await expect(ingestJob(validInput)).rejects.toThrow(
        "Invalid job input: title: Title is required",
      );
    });
  });

  describe("unique ingestion (CREATED)", () => {
    it("creates a new job when no duplicate detected", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "UNIQUE",
        level: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        confidence: 1.0,
        reason: "No duplicate",
      });

      const result = await ingestJob(validInput);

      expect(result.outcome).toBe("CREATED");
      expect(result.jobId).toBe("job-1");
      expect(result.jobSourceId).toBe("js-1");
      expect(mockUpsertJob).toHaveBeenCalledOnce();
    });

    it("resolves all entities", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "UNIQUE",
        level: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        confidence: 1.0,
        reason: "No duplicate",
      });

      await ingestJob(validInput);

      expect(mockResolveOrg).toHaveBeenCalledWith("Black Lion Hospital");
      expect(mockResolveLocation).toHaveBeenCalledWith("Addis Ababa");
      expect(mockResolveProfession).toHaveBeenCalledWith("Nursing");
      expect(mockResolveCategory).toHaveBeenCalledWith("Healthcare");
    });
  });

  describe("SOURCE_IDENTIFIER duplicate", () => {
    it("returns DUPLICATE for L1 match with unchanged content", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "SOURCE_IDENTIFIER",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 1.0,
        reason: "Exact match",
      });
      mockGetStoredHash.mockResolvedValue("same-hash");
      mockContentChanged.mockReturnValue(false);

      const result = await ingestJob({
        ...validInput,
        externalId: "ext-123",
      });

      expect(result.outcome).toBe("DUPLICATE");
      expect(result.matchedJobId).toBe("existing-job");
      expect(mockUpdateLastSeenAt).toHaveBeenCalledWith("existing-js");
    });

    it("updates content when hash changed at L1", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "SOURCE_IDENTIFIER",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 1.0,
        reason: "Exact match",
      });
      mockGetStoredHash.mockResolvedValue("old-hash");
      mockContentChanged.mockReturnValue(true);

      const result = await ingestJob({
        ...validInput,
        externalId: "ext-123",
      });

      expect(result.outcome).toBe("UPDATED");
      expect(mockUpdateJob).toHaveBeenCalledOnce();
    });
  });

  describe("SOURCE_URL duplicate", () => {
    it("returns DUPLICATE for L2 match with unchanged content", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "SOURCE_URL",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 0.99,
        reason: "URL match",
      });
      mockGetStoredHash.mockResolvedValue("same-hash");
      mockContentChanged.mockReturnValue(false);

      const result = await ingestJob({
        ...validInput,
        sourceUrl: "https://example.com/job/1",
      });

      expect(result.outcome).toBe("DUPLICATE");
      expect(mockUpdateLastSeenAt).toHaveBeenCalledWith("existing-js");
    });

    it("updates content when hash changed at L2", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "SOURCE_URL",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 0.99,
        reason: "URL match",
      });
      mockGetStoredHash.mockResolvedValue("old-hash");
      mockContentChanged.mockReturnValue(true);

      const result = await ingestJob({
        ...validInput,
        sourceUrl: "https://example.com/job/1",
      });

      expect(result.outcome).toBe("UPDATED");
      expect(mockUpdateJob).toHaveBeenCalledOnce();
    });
  });

  describe("CONTENT_HASH duplicate (L3 cross-source)", () => {
    it("creates jobSource link for cross-source match with unchanged content", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "CONTENT_HASH",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 0.95,
        reason: "Hash match",
      });
      mockCreateJobSource.mockResolvedValue("new-js");
      mockGetStoredHash.mockResolvedValue("same-hash");
      mockContentChanged.mockReturnValue(false);

      const result = await ingestJob(validInput);

      expect(result.outcome).toBe("UPDATED");
      expect(mockCreateJobSource).toHaveBeenCalledWith({
        jobId: "existing-job",
        sourceId: "source-1",
        sourceUrl: null,
        externalId: null,
        rawHash: "mock-hash-123",
      });
    });

    it("updates job when content changed at L3", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "DUPLICATE",
        level: "CONTENT_HASH",
        matchedJobId: "existing-job",
        matchedJobSourceId: "existing-js",
        confidence: 0.95,
        reason: "Hash match",
      });
      mockCreateJobSource.mockResolvedValue("new-js");
      mockGetStoredHash.mockResolvedValue("old-hash");
      mockContentChanged.mockReturnValue(true);

      const result = await ingestJob(validInput);

      expect(result.outcome).toBe("UPDATED");
      expect(mockUpdateJob).toHaveBeenCalledOnce();
    });
  });

  describe("ORG_TITLE_LOCATION match (L4)", () => {
    it("creates jobSource link for L4 POSSIBLE_DUPLICATE", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "POSSIBLE_DUPLICATE",
        level: "ORG_TITLE_LOCATION",
        matchedJobId: "existing-job",
        matchedJobSourceId: null,
        confidence: 0.8,
        reason: "Org+title+location match",
      });
      mockCreateJobSource.mockResolvedValue("new-js");

      const result = await ingestJob(validInput);

      expect(result.outcome).toBe("LINKED");
      expect(result.matchedJobId).toBe("existing-job");
      expect(mockCreateJobSource).toHaveBeenCalledOnce();
    });
  });

  describe("POSSIBLE_DUPLICATE without specific level", () => {
    it("returns POSSIBLE_DUPLICATE when classification is POSSIBLE_DUPLICATE but level is not ORG_TITLE_LOCATION", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "POSSIBLE_DUPLICATE",
        level: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        confidence: 0.5,
        reason: "Uncertain match",
      });

      const result = await ingestJob(validInput);

      expect(result.outcome).toBe("POSSIBLE_DUPLICATE");
    });
  });

  describe("error propagation", () => {
    it("propagates database errors from upsertJob", async () => {
      mockDetectDuplicate.mockResolvedValue({
        classification: "UNIQUE",
        level: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        confidence: 1.0,
        reason: "No duplicate",
      });
      mockUpsertJob.mockRejectedValue(new Error("DB connection failed"));

      await expect(ingestJob(validInput)).rejects.toThrow(
        "DB connection failed",
      );
    });

    it("propagates errors from entity resolution", async () => {
      mockResolveOrg.mockRejectedValue(new Error("Org resolution failed"));

      await expect(ingestJob(validInput)).rejects.toThrow(
        "Org resolution failed",
      );
    });
  });
});
