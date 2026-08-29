import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSourcesFindFirst = vi.fn();
const mockIngestJobs = vi.fn();

const { mockAssertTrustedCsrfFromRequest } = vi.hoisted(() => ({
  mockAssertTrustedCsrfFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: mockAssertTrustedCsrfFromRequest,
  CsrfError: class CsrfError extends Error {
    constructor() {
      super("Unexpected request origin");
      this.name = "CsrfError";
    }
  },
}));

vi.mock("../../../db", () => ({
  db: {
    query: {
      sources: { findFirst: (...args: unknown[]) => mockSourcesFindFirst(...args) },
    },
  },
}));

vi.mock("../../../db/schema/sources", () => ({
  sources: { id: "sources.id", isActive: "sources.isActive" },
}));

vi.mock("../../ingestion/batch", () => ({
  ingestJobs: (...args: unknown[]) => mockIngestJobs(...args),
}));

import { POST } from "../../../app/api/jobs/ingest/route";

const VALID_SOURCE_ID = "550e8400-e29b-41d4-a716-446655440000";
const API_KEY = "test-api-key-123";

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/jobs/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeJob() {
  return {
    title: "Staff Nurse",
    description: "Nursing role at hospital",
    organizationName: "Black Lion Hospital",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGESTION_API_KEY", API_KEY);

  mockSourcesFindFirst.mockResolvedValue({
    id: VALID_SOURCE_ID,
    isActive: true,
  });

  mockIngestJobs.mockResolvedValue({
    items: [
      {
        index: 0,
        outcome: "CREATED",
        jobId: "job-1",
        jobSourceId: "js-1",
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
        error: null,
      },
    ],
    summary: {
      total: 1,
      created: 1,
      duplicate: 0,
      updated: 0,
      linked: 0,
      possibleDuplicate: 0,
      failed: 0,
    },
  });
});

describe("POST /api/jobs/ingest", () => {
  describe("authentication", () => {
    it("returns 401 when x-api-key is missing", async () => {
      const req = new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: VALID_SOURCE_ID, jobs: [makeJob()] }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 when x-api-key is invalid", async () => {
      const request = makeRequest(
        { sourceId: VALID_SOURCE_ID, jobs: [makeJob()] },
        { "x-api-key": "wrong-key" },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 500 when INGESTION_API_KEY is not configured", async () => {
      vi.stubEnv("INGESTION_API_KEY", undefined);

      const request = makeRequest({ sourceId: VALID_SOURCE_ID, jobs: [makeJob()] });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Server configuration error");
    });
  });

  describe("JSON parsing", () => {
    it("returns 400 for malformed JSON", async () => {
      const request = new Request("http://localhost/api/jobs/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: "not valid json {{{",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });
  });

  describe("request validation", () => {
    it("returns 400 when sourceId is missing", async () => {
      const request = makeRequest({ jobs: [makeJob()] });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceId");
    });

    it("returns 400 when sourceId is not a UUID", async () => {
      const request = makeRequest({
        sourceId: "not-a-uuid",
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("sourceId");
    });

    it("returns 400 when jobs is missing", async () => {
      const request = makeRequest({ sourceId: VALID_SOURCE_ID });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("jobs");
    });

    it("returns 400 when jobs is not an array", async () => {
      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: "not-an-array",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("jobs");
    });

    it("returns 400 when jobs array is empty", async () => {
      const request = makeRequest({ sourceId: VALID_SOURCE_ID, jobs: [] });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("jobs");
    });

    it("returns 400 when jobs array exceeds 100 items", async () => {
      const jobs = Array.from({ length: 101 }, () => makeJob());
      const request = makeRequest({ sourceId: VALID_SOURCE_ID, jobs });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("jobs");
    });
  });

  describe("source existence", () => {
    it("returns 404 when source does not exist", async () => {
      mockSourcesFindFirst.mockResolvedValue(null);

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found or inactive");
    });

    it("returns 404 when source is inactive", async () => {
      mockSourcesFindFirst.mockResolvedValue({
        id: VALID_SOURCE_ID,
        isActive: false,
      });

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Source not found or inactive");
    });
  });

  describe("successful ingestion", () => {
    it("calls ingestJobs with sourceId and jobs", async () => {
      const jobs = [makeJob()];
      const request = makeRequest({ sourceId: VALID_SOURCE_ID, jobs });

      await POST(request);

      expect(mockIngestJobs).toHaveBeenCalledWith({
        sourceId: VALID_SOURCE_ID,
        jobs,
      });
    });

    it("returns 200 with CREATED result", async () => {
      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.created).toBe(1);
      expect(data.items[0].outcome).toBe("CREATED");
    });

    it("returns 200 with DUPLICATE result", async () => {
      mockIngestJobs.mockResolvedValue({
        items: [
          {
            index: 0,
            outcome: "DUPLICATE",
            jobId: null,
            jobSourceId: null,
            matchedJobId: "existing-job",
            matchedJobSourceId: "existing-js",
            duplicateLevel: "SOURCE_IDENTIFIER",
            duplicateConfidence: 1.0,
            duplicateReason: "Match",
            error: null,
          },
        ],
        summary: {
          total: 1,
          created: 0,
          duplicate: 1,
          updated: 0,
          linked: 0,
          possibleDuplicate: 0,
          failed: 0,
        },
      });

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.duplicate).toBe(1);
      expect(data.items[0].outcome).toBe("DUPLICATE");
    });

    it("returns 200 when batch contains failed items (per-item isolation)", async () => {
      mockIngestJobs.mockResolvedValue({
        items: [
          {
            index: 0,
            outcome: "CREATED",
            jobId: "job-1",
            jobSourceId: "js-1",
            matchedJobId: null,
            matchedJobSourceId: null,
            duplicateLevel: null,
            duplicateConfidence: null,
            duplicateReason: null,
            error: null,
          },
          {
            index: 1,
            outcome: "CREATED",
            jobId: null,
            jobSourceId: null,
            matchedJobId: null,
            matchedJobSourceId: null,
            duplicateLevel: null,
            duplicateConfidence: null,
            duplicateReason: null,
            error: "Invalid job input: title: Title is required",
          },
        ],
        summary: {
          total: 2,
          created: 1,
          duplicate: 0,
          updated: 0,
          linked: 0,
          possibleDuplicate: 0,
          failed: 1,
        },
      });

      const jobs = [makeJob(), { description: "missing title" }];
      const request = makeRequest({ sourceId: VALID_SOURCE_ID, jobs });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.total).toBe(2);
      expect(data.summary.created).toBe(1);
      expect(data.summary.failed).toBe(1);
      expect(data.items[1].error).toContain("Invalid job input");
    });

    it("allows malformed individual job objects through to ingestion", async () => {
      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [{ not: "a valid job" }],
      });

      await POST(request);

      expect(mockIngestJobs).toHaveBeenCalledWith({
        sourceId: VALID_SOURCE_ID,
        jobs: [{ not: "a valid job" }],
      });
    });
  });

  describe("error handling", () => {
    it("returns 500 when source lookup throws unexpectedly", async () => {
      mockSourcesFindFirst.mockRejectedValue(new Error("DB connection lost"));

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("returns 500 when ingestJobs throws unexpectedly", async () => {
      mockIngestJobs.mockRejectedValue(new Error("Unexpected failure"));

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("does not expose underlying error message in 500 responses", async () => {
      mockIngestJobs.mockRejectedValue(
        new Error("SECRET_DB_PASSWORD=xyz connection refused"),
      );

      const request = makeRequest({
        sourceId: VALID_SOURCE_ID,
        jobs: [makeJob()],
      });

      const response = await POST(request);
      const body = await response.text();

      expect(body).not.toContain("SECRET_DB_PASSWORD");
      expect(body).not.toContain("xyz");
    });
  });
});
