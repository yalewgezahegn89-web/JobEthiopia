import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDbTransaction: vi.fn(),
}));

vi.mock("../../../db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockDbTransaction(...args),
  },
}));

import { createJobDirect } from "../createJobDirect";
import type { CreateJobDirectInput } from "../createJobDirect";

const API_SOURCE_ID = "66666666-6666-4666-8666-666666666666";
const TRUSTED_ORG_ID = "22222222-2222-4222-8222-222222222222";

const INPUT: CreateJobDirectInput = {
  title: "Staff Nurse",
  slug: "staff-nurse",
  description: "Nursing role at a hospital with full-time patient care duties.",
};

const CREATED_JOB = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Staff Nurse",
  slug: "staff-nurse",
  organizationId: TRUSTED_ORG_ID,
  categoryId: null,
  professionId: null,
  locationId: null,
  description: INPUT.description,
  responsibilities: null,
  requirements: null,
  educationRequirements: null,
  benefits: null,
  experienceMin: null,
  experienceMax: null,
  employmentType: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
  postedAt: null,
  deadline: null,
  applicationUrl: null,
  status: "DRAFT",
  verificationStatus: "PENDING",
  firstSeenAt: new Date("2026-01-01"),
  lastVerifiedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function buildTxSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

function buildTxInsertChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(
    Array.isArray(result) ? result : [result],
  );
  return chain;
}

function buildSuccessTx(createdJob: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnValueOnce(
      buildTxSelectChain([{ id: API_SOURCE_ID }]),
    ),
    insert: vi.fn()
      .mockReturnValueOnce(buildTxInsertChain(createdJob))
      .mockReturnValueOnce(buildTxInsertChain(undefined)),
  };
}

function runWithTx(tx: unknown) {
  mocks.mockDbTransaction.mockImplementation(
    (cb: (t: unknown) => Promise<unknown>) => cb(tx),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createJobDirect", () => {
  it("creates a DRAFT/PENDING job for the server-controlled organization", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    const result = await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    expect(result.status).toBe("DRAFT");
    expect(result.verificationStatus).toBe("PENDING");

    const jobInsert = tx.insert.mock.results[0].value;
    const jobData = jobInsert.values.mock.calls[0][0];
    expect(jobData.organizationId).toBe(TRUSTED_ORG_ID);
    expect(jobData.status).toBe("DRAFT");
    expect(jobData.verificationStatus).toBe("PENDING");
  });

  it("writes exactly one job_sources row on success", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    const result = await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    expect(result.id).toBe(CREATED_JOB.id);
    expect(tx.insert).toHaveBeenCalledTimes(2);

    const jobInsert = tx.insert.mock.results[0].value;
    expect(jobInsert.values).toHaveBeenCalledTimes(1);

    const sourceInsert = tx.insert.mock.results[1].value;
    expect(sourceInsert.values).toHaveBeenCalledTimes(1);
  });

  it("uses the server-resolved API source for sourceId", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData).toEqual({
      jobId: CREATED_JOB.id,
      sourceId: API_SOURCE_ID,
      sourceUrl: `jobethiopia://source/${API_SOURCE_ID}/external/none`,
      externalId: null,
      rawHash: null,
      lastSeenAt: null,
    });
    expect(sourceData).not.toHaveProperty("sourceType");
    expect(INPUT).not.toHaveProperty("sourceId");
    expect(INPUT).not.toHaveProperty("sourceType");
  });

  it("stores a server-controlled internal provenance URL", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.sourceUrl).toBe(
      `jobethiopia://source/${API_SOURCE_ID}/external/none`,
    );
    expect(sourceData.sourceUrl).not.toMatch(/^https?:\/\//);
  });

  it("leaves externalId and rawHash null and defaults firstSeenAt/timestamps", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    const sourceInsert = tx.insert.mock.results[1].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.externalId).toBeNull();
    expect(sourceData.rawHash).toBeNull();
    expect(sourceData.lastSeenAt).toBeNull();
    expect(sourceData).not.toHaveProperty("firstSeenAt");
    expect(sourceData).not.toHaveProperty("createdAt");
    expect(sourceData).not.toHaveProperty("updatedAt");
  });

  it("rolls back job creation when provenance insertion fails", async () => {
    const provenanceError = new Error("insert or update on table job_sources");
    const provenanceChain = {
      values: vi.fn().mockRejectedValue(provenanceError),
    };

    const tx = {
      select: vi.fn().mockReturnValueOnce(
        buildTxSelectChain([{ id: API_SOURCE_ID }]),
      ),
      insert: vi.fn()
        .mockReturnValueOnce(buildTxInsertChain(CREATED_JOB))
        .mockReturnValueOnce(provenanceChain),
    };
    runWithTx(tx);

    await expect(
      createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID }),
    ).rejects.toThrow("insert or update on table job_sources");
  });

  it("rejects when the API source record is missing", async () => {
    const tx = {
      select: vi.fn().mockReturnValueOnce(buildTxSelectChain([])),
      insert: vi.fn(),
    };
    runWithTx(tx);

    await expect(
      createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID }),
    ).rejects.toThrow("API source record not configured");
  });

  it("runs the job and provenance writes inside a single transaction", async () => {
    const tx = buildSuccessTx(CREATED_JOB);
    runWithTx(tx);

    await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    expect(mocks.mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it("retries a fresh slug when the first insert returns no row", async () => {
    const retryJob = { ...CREATED_JOB, slug: "staff-nurse-1" };

    const tx = {
      select: vi.fn().mockReturnValueOnce(
        buildTxSelectChain([{ id: API_SOURCE_ID }]),
      ),
      insert: vi.fn()
        .mockReturnValueOnce(buildTxInsertChain([]))
        .mockReturnValueOnce(buildTxInsertChain(retryJob))
        .mockReturnValueOnce(buildTxInsertChain(undefined)),
    };
    runWithTx(tx);

    const result = await createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID });

    expect(result.slug).toBe("staff-nurse-1");

    const sourceInsert = tx.insert.mock.results[2].value;
    const sourceData = sourceInsert.values.mock.calls[0][0];
    expect(sourceData.jobId).toBe(retryJob.id);
  });

  it("throws after exhausting slug retries", async () => {
    const tx = {
      select: vi.fn().mockReturnValueOnce(
        buildTxSelectChain([{ id: API_SOURCE_ID }]),
      ),
      insert: vi.fn().mockReturnValue(buildTxInsertChain([])),
    };
    runWithTx(tx);

    await expect(
      createJobDirect(INPUT, { organizationId: TRUSTED_ORG_ID }),
    ).rejects.toThrow("Could not create job with unique slug after 11 attempts");
  });
});