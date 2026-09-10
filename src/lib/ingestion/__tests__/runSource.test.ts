import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  activeSources: [] as Array<Record<string, unknown>>,
  mockIngestJobs: vi.fn(),
  mockRecordSuccess: vi.fn(),
  mockRecordFailed: vi.fn(),
  mockIsDue: vi.fn(),
  mockGetAdapter: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(mocks.activeSources),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/ingestion/batch", () => ({
  ingestJobs: (...args: unknown[]) => mocks.mockIngestJobs(...args),
}));

vi.mock("@/lib/sources/health", () => ({
  recordSuccessfulCheck: (...args: unknown[]) =>
    mocks.mockRecordSuccess(...args),
  recordFailedCheck: (...args: unknown[]) => mocks.mockRecordFailed(...args),
  isSourceDueForCheck: (...args: unknown[]) => mocks.mockIsDue(...args),
}));

vi.mock("@/lib/sources/adapters", () => ({
  getAdapterForSource: (...args: unknown[]) => mocks.mockGetAdapter(...args),
}));

import {
  runSourceIngestion,
  runSourcesIngestion,
} from "../runSource";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";

function sourceRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: SOURCE_ID,
    name: "Example Feed",
    sourceType: "FEED",
    isActive: true,
    ...overrides,
  };
}

function successAdapter(jobs: unknown[] = []) {
  return {
    fetchJobs: vi.fn().mockResolvedValue({ success: true, jobs }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeSources = [];
  mocks.mockFindFirst.mockResolvedValue(sourceRow());
  mocks.mockIsDue.mockResolvedValue(true);
  mocks.mockGetAdapter.mockReturnValue(successAdapter());
  mocks.mockRecordSuccess.mockResolvedValue({});
  mocks.mockRecordFailed.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runSourceIngestion", () => {
  it("returns FAILED when the source does not exist", async () => {
    mocks.mockFindFirst.mockResolvedValue(undefined);
    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("Source not found");
    expect(mocks.mockRecordFailed).not.toHaveBeenCalled();
  });

  it("returns SKIPPED for an inactive source", async () => {
    mocks.mockFindFirst.mockResolvedValue(sourceRow({ isActive: false }));
    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("SKIPPED");
    expect(result.reason).toBe("Source is inactive");
    expect(mocks.mockGetAdapter).not.toHaveBeenCalled();
  });

  it("returns SKIPPED for an unsupported source type without fetching", async () => {
    mocks.mockFindFirst.mockResolvedValue(sourceRow({ sourceType: "WEBSITE" }));
    mocks.mockGetAdapter.mockReturnValue(null);
    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("SKIPPED");
    expect(result.reason).toBe("Unsupported source type: WEBSITE");
    expect(mocks.mockRecordSuccess).not.toHaveBeenCalled();
    expect(mocks.mockRecordFailed).not.toHaveBeenCalled();
  });

  it("records a failed check and returns FAILED when the adapter reports failure", async () => {
    const adapter = successAdapter();
    adapter.fetchJobs.mockResolvedValue({ success: false, error: "HTTP 503" });
    mocks.mockGetAdapter.mockReturnValue(adapter);

    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("HTTP 503");
    expect(mocks.mockRecordFailed).toHaveBeenCalledWith(SOURCE_ID, "HTTP 503");
    expect(mocks.mockRecordSuccess).not.toHaveBeenCalled();
  });

  it("records a successful check and returns SUCCEEDED for an empty feed", async () => {
    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.reason).toBeNull();
    expect(result.total).toBe(0);
    expect(mocks.mockRecordSuccess).toHaveBeenCalledWith(SOURCE_ID);
    expect(mocks.mockIngestJobs).not.toHaveBeenCalled();
  });

  it("feeds fetched jobs into the batch pipeline and maps the summary", async () => {
    const jobs = [{ title: "A", description: "D", organizationName: "O" }];
    mocks.mockGetAdapter.mockReturnValue(successAdapter(jobs));
    mocks.mockIngestJobs.mockResolvedValue({
      items: [],
      summary: {
        total: 1,
        created: 1,
        updated: 0,
        duplicate: 0,
        linked: 0,
        possibleDuplicate: 0,
        failed: 0,
      },
    });

    const result = await runSourceIngestion(SOURCE_ID);
    expect(mocks.mockIngestJobs).toHaveBeenCalledWith({
      sourceId: SOURCE_ID,
      jobs,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.total).toBe(1);
    expect(result.created).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a failed check when the adapter throws", async () => {
    const adapter = successAdapter();
    adapter.fetchJobs.mockRejectedValue(new Error("Network unreachable"));
    mocks.mockGetAdapter.mockReturnValue(adapter);

    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("Network unreachable");
    expect(mocks.mockRecordFailed).toHaveBeenCalledWith(
      SOURCE_ID,
      "Network unreachable",
    );
  });

  it("records a failed check when the batch pipeline throws", async () => {
    mocks.mockGetAdapter.mockReturnValue(
      successAdapter([{ title: "A", description: "D", organizationName: "O" }]),
    );
    mocks.mockIngestJobs.mockRejectedValue(new Error("DB down"));

    const result = await runSourceIngestion(SOURCE_ID);
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("DB down");
    expect(mocks.mockRecordFailed).toHaveBeenCalledWith(SOURCE_ID, "DB down");
  });

  it("never publishes: imported jobs stay DRAFT/PENDING via the pipeline", async () => {
    // The batch ingestion is responsible for the DRAFT/PENDING lifecycle;
    // runSourceIngestion must simply forward listings unchanged.
    const jobs = [{ title: "A", description: "D", organizationName: "O" }];
    mocks.mockGetAdapter.mockReturnValue(successAdapter(jobs));
    mocks.mockIngestJobs.mockResolvedValue({
      items: [],
      summary: {
        total: 1,
        created: 0,
        updated: 1,
        duplicate: 0,
        linked: 0,
        possibleDuplicate: 0,
        failed: 0,
      },
    });
    const result = await runSourceIngestion(SOURCE_ID);
    expect(mocks.mockIngestJobs).toHaveBeenCalledWith({
      sourceId: SOURCE_ID,
      jobs,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.updated).toBe(1);
  });
});

describe("runSourcesIngestion", () => {
  it("returns zeros when no active sources exist", async () => {
    mocks.activeSources = [];
    const result = await runSourcesIngestion();
    expect(result).toEqual({ checked: 0, succeeded: 0, failed: 0, skipped: 0 });
  });

  it("silently skips sources that are not due", async () => {
    mocks.activeSources = [
      {
        id: SOURCE_ID,
        baseUrl: "https://feed.example.com/jobs.json",
        lastSuccessfulCheck: new Date(),
        checkFrequencyMinutes: 60,
      },
    ];
    mocks.mockIsDue.mockResolvedValue(false);
    const result = await runSourcesIngestion();
    expect(result).toEqual({ checked: 0, succeeded: 0, failed: 0, skipped: 0 });
  });

  it("counts due sources without a baseUrl as skipped", async () => {
    mocks.activeSources = [
      {
        id: SOURCE_ID,
        baseUrl: null,
        lastSuccessfulCheck: null,
        checkFrequencyMinutes: 60,
      },
    ];
    const result = await runSourcesIngestion();
    expect(result).toEqual({ checked: 0, succeeded: 0, failed: 0, skipped: 1 });
  });

  it("runs due sources and counts the outcomes", async () => {
    mocks.activeSources = [
      { id: SOURCE_ID, baseUrl: "https://feed.example.com/jobs.json" },
    ];
    const result = await runSourcesIngestion();
    expect(result.checked).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("isolates a failing source without stopping the others", async () => {
    mocks.activeSources = [
      { id: "failing-source", baseUrl: "https://a.example.com/jobs.json" },
      { id: "ok-source", baseUrl: "https://b.example.com/jobs.json" },
    ];
    mocks.mockGetAdapter.mockImplementation(() => {
      const adapter = successAdapter();
      adapter.fetchJobs.mockImplementation((sid: string) =>
        sid === "failing-source"
          ? { success: false, error: "boom" }
          : { success: true, jobs: [] },
      );
      return adapter;
    });

    const result = await runSourcesIngestion();
    expect(result.checked).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
  });
});