import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/lib/auth/roles", () => ({
  isStaffRole: (role: string) =>
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "MODERATOR",
}));

import { createCuratedJob } from "@/lib/admin/curatedJobs";
import type { AuthUser } from "@/lib/auth/roles";
import type { EmployerCreateJobInput } from "@/lib/validations/employerJob";

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ID = "55555555-5555-4555-8555-555555555555";

function staffActor(role: AuthUser["role"]): AuthUser {
  return { id: ACTOR_ID, email: "staff@example.com", name: "Staff", role };
}

function validInput(overrides: Record<string, unknown> = {}): EmployerCreateJobInput {
  return {
    organizationId: ORG_ID,
    title: "Senior Accountant",
    description: "A detailed accounting role with full responsibility for the ledger.",
    employmentType: "FULL_TIME",
    ...overrides,
  } as EmployerCreateJobInput;
}

function selectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

function collectSqlParams(chunk: unknown): unknown[] {
  const params: unknown[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      if ("value" in value && "encoder" in value) {
        params.push((value as { value: unknown }).value);
      }
      if ("queryChunks" in value) {
        visit((value as { queryChunks: unknown[] }).queryChunks);
      }
    } else if (typeof value === "string") {
      params.push(value);
    }
  };
  visit(chunk);
  return params;
}

function insertChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]);
  return chain;
}

function createdJobRow(slug = "senior-accountant") {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Senior Accountant",
    slug,
    organizationId: ORG_ID,
    categoryId: null,
    professionId: null,
    locationId: null,
    description: "A detailed accounting role with full responsibility for the ledger.",
    responsibilities: null,
    requirements: null,
    educationRequirements: null,
    benefits: null,
    experienceMin: null,
    experienceMax: null,
    employmentType: "FULL_TIME" as const,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    postedAt: null,
    deadline: null,
    applicationUrl: null,
    status: "DRAFT" as const,
    verificationStatus: "PENDING" as const,
    firstSeenAt: new Date("2026-01-01"),
    lastVerifiedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

/**
 * Builds a success tx. Select order matches createCuratedJob:
 * 1st select = duplicate lookup (no match by default),
 * 2nd select = Manual source resolution,
 * then inserts job + job_source + audit.
 */
function buildSuccessTx(jobRow = createdJobRow()) {
  return {
    select: vi
      .fn()
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
    insert: vi
      .fn()
      .mockReturnValueOnce(insertChain(jobRow))
      .mockReturnValueOnce(insertChain(undefined))
      .mockReturnValueOnce(insertChain(undefined)),
  };
}

function buildWarningTxChain(
  duplicateChain: Record<string, ReturnType<typeof vi.fn>>,
  jobRow = createdJobRow(),
) {
  return {
    select: vi
      .fn()
      .mockReturnValueOnce(duplicateChain)
      .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
    insert: vi
      .fn()
      .mockReturnValueOnce(insertChain(jobRow))
      .mockReturnValueOnce(insertChain(undefined))
      .mockReturnValueOnce(insertChain(undefined)),
  };
}

const MATCHED_JOB_ID = "66666666-6666-4666-8666-666666666666";

function duplicateMatch(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: MATCHED_JOB_ID,
    title: "Senior Accountant",
    status,
    ...overrides,
  };
}

function runWithTx(tx: unknown) {
  mocks.mockTransaction.mockImplementation(
    (cb: (t: unknown) => Promise<unknown>) => cb(tx),
  );
}

function capturedInserts(tx: { insert: ReturnType<typeof vi.fn> }) {
  return {
    job: tx.insert.mock.results[0].value.values.mock.calls[0][0],
    jobSource: tx.insert.mock.results[1].value.values.mock.calls[0][0],
    audit: tx.insert.mock.results[2].value.values.mock.calls[0][0],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCuratedJob — authorization", () => {
  it("allows SUPER_ADMIN to create a curated job", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("SUPER_ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.item.id).toBe(createdJobRow().id);
  });

  it("allows ADMIN to create a curated job", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
  });

  it("allows MODERATOR to create a curated job", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("MODERATOR"), validInput());
    expect(result.ok).toBe(true);
  });

  it("rejects a non-staff actor without touching the db", async () => {
    const result = await createCuratedJob(
      staffActor("CANDIDATE"),
      validInput(),
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects an ORGANIZATION_ADMIN (not staff) actor", async () => {
    const result = await createCuratedJob(
      staffActor("ORGANIZATION_ADMIN"),
      validInput(),
    );
    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});

describe("createCuratedJob — validation", () => {
  it("rejects invalid input without a transaction", async () => {
    const result = await createCuratedJob(
      staffActor("ADMIN"),
      validInput({ title: "" }),
    );
    expect(result).toEqual({ ok: false, code: "VALIDATION" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });
});

describe("createCuratedJob — source resolution", () => {
  it("resolves the Manual Entry source by name, not a client-supplied id", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);

    const input = validInput();
    const result = await createCuratedJob(staffActor("ADMIN"), input);

    expect(result.ok).toBe(true);
    const { jobSource } = capturedInserts(tx);
    expect(jobSource.sourceId).toBe(SOURCE_ID);
    // no client-controlled source ids reach the provenance write
    expect(input).not.toHaveProperty("sourceId");
    expect(input).not.toHaveProperty("sourceType");
    expect(tx.select).toHaveBeenCalledTimes(2); // duplicate lookup + Manual source
  });

  it("fails clearly when the Manual Entry source is absent", async () => {
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([])),
      insert: vi.fn(),
    };
    runWithTx(tx);

    await expect(
      createCuratedJob(staffActor("ADMIN"), validInput()),
    ).rejects.toThrow("Manual Entry source record not configured");
  });
});

describe("createCuratedJob — initial state", () => {
  it("creates the job with status DRAFT", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    const { job, jobSource } = capturedInserts(tx);
    expect(job.status).toBe("DRAFT");
    expect(jobSource.jobId).toBe(createdJobRow().id);
  });

  it("creates the job with verificationStatus PENDING", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    const { job } = capturedInserts(tx);
    expect(job.verificationStatus).toBe("PENDING");
  });

  it("does not accept client-controlled status or verificationStatus (strict schema rejects them)", async () => {
    // The strict employerCreateJobSchema rejects unknown fields, so a client
    // cannot inject status/verificationStatus; the job can only ever start DRAFT/PENDING.
    const result = await createCuratedJob(
      staffActor("ADMIN"),
      validInput({ status: "PUBLISHED", verificationStatus: "VERIFIED" }),
    );
    expect(result).toEqual({ ok: false, code: "VALIDATION" });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });
});

describe("createCuratedJob — provenance & atomicity", () => {
  it("writes exactly one Manual job_sources row", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    expect(tx.insert).toHaveBeenCalledTimes(3); // job + job_source + audit
  });

  it("uses the existing internal provenance helper/pattern", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    const { jobSource } = capturedInserts(tx);
    expect(jobSource).toEqual({
      jobId: createdJobRow().id,
      sourceId: SOURCE_ID,
      sourceUrl: `jobethiopia://source/${SOURCE_ID}/external/none`,
      externalId: null,
      rawHash: null,
      lastSeenAt: null,
    });
    expect(jobSource.sourceUrl).not.toMatch(/^https?:\/\//);
  });

  it("commits job + provenance atomically in a single transaction", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(mocks.mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("rolls back the job when provenance insertion fails", async () => {
    const providenceError = new Error("insert or update on table job_sources");
    const failingProvenanceChain = {
      values: vi.fn().mockRejectedValue(providenceError),
    };

    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
      insert: vi
        .fn()
        .mockReturnValueOnce(insertChain(createdJobRow()))
        .mockReturnValueOnce(failingProvenanceChain),
    };
    runWithTx(tx);

    await expect(
      createCuratedJob(staffActor("ADMIN"), validInput()),
    ).rejects.toThrow("insert or update on table job_sources");
  });
});

describe("createCuratedJob — audit", () => {
  it("writes a JOB_CREATED audit event with curated metadata", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("MODERATOR"), validInput());
    const { audit } = capturedInserts(tx);
    expect(audit.action).toBe("JOB_CREATED");
    expect(audit.actorUserId).toBe(ACTOR_ID);
    expect(audit.targetType).toBe("job");
    expect(audit.targetId).toBe(createdJobRow().id);
    expect(audit.metadata).toMatchObject({
      source: "manual",
      sourceId: SOURCE_ID,
      organizationId: ORG_ID,
    });
  });
});

describe("createCuratedJob — slug handling", () => {
  it("generates a normal slug from the title", async () => {
    const tx = buildSuccessTx();
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    const { job } = capturedInserts(tx);
    expect(job.slug).toBe("senior-accountant");
  });

  it("retries a fresh slug when the first insert returns no row", async () => {
    const retryJob = createdJobRow("senior-accountant-1");
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
      insert: vi
        .fn()
        .mockReturnValueOnce(insertChain([]))
        .mockReturnValueOnce(insertChain(retryJob))
        .mockReturnValueOnce(insertChain(undefined))
        .mockReturnValueOnce(insertChain(undefined)),
    };
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.item.slug).toBe("senior-accountant-1");
  });

  it("uses the retried slug for the provenance jobId", async () => {
    const retryJob = createdJobRow("senior-accountant-1");
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
      insert: vi
        .fn()
        .mockReturnValueOnce(insertChain([]))
        .mockReturnValueOnce(insertChain(retryJob))
        .mockReturnValueOnce(insertChain(undefined))
        .mockReturnValueOnce(insertChain(undefined)),
    };
    runWithTx(tx);
    await createCuratedJob(staffActor("ADMIN"), validInput());
    // with a retried slug, job_source is the 3rd insert (index 2)
    const jobSource = tx.insert.mock.results[2].value.values.mock.calls[0][0];
    expect(jobSource.jobId).toBe(retryJob.id);
  });

  it("returns SLUG_COLLISION after exhausting retries", async () => {
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([]))
        .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
      insert: vi.fn().mockReturnValue(insertChain([])),
    };
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result).toEqual({ ok: false, code: "SLUG_COLLISION" });
  });

  it("keeps slug retry intact when a duplicate warning is also raised", async () => {
    const retryJob = createdJobRow("senior-accountant-1");
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectChain([duplicateMatch("PUBLISHED")]))
        .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
      insert: vi
        .fn()
        .mockReturnValueOnce(insertChain([]))
        .mockReturnValueOnce(insertChain(retryJob))
        .mockReturnValueOnce(insertChain(undefined))
        .mockReturnValueOnce(insertChain(undefined)),
    };
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.slug).toBe("senior-accountant-1");
      expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
    }
  });
});

describe("createCuratedJob — duplicate warning (L4 org + normalized title + location)", () => {
  const OTHER_ORG_ID = "77777777-7777-4777-8777-777777777777";
  const LOCATION_A = "aaaa1111-1111-4111-8111-111111111111";
  const LOCATION_B = "bbbb1111-1111-4111-8111-111111111111";

  it.each(["DRAFT", "PENDING_REVIEW", "PUBLISHED"] as const)(
    "warns when an existing %s job matches org + normalized title + same location",
    async (status) => {
      const duplicateChain = selectChain([duplicateMatch(status)]);
      const tx = buildWarningTxChain(duplicateChain);
      runWithTx(tx);
      const result = await createCuratedJob(
        staffActor("ADMIN"),
        validInput({ locationId: LOCATION_A }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warning).toBeDefined();
        expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
        expect(result.warning?.matchedStatus).toBe(status);
      }
    },
  );

  it("warns on title case differences (case-insensitive title match)", async () => {
    const duplicateChain = selectChain([
      duplicateMatch("PUBLISHED", { title: "SENIOR ACCOUNTANT" }),
    ]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(
      staffActor("ADMIN"),
      validInput({ title: "SENIOR   ACCOUNTANT  " }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning?.matchedJobTitle).toBe("SENIOR ACCOUNTANT");
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain("SENIOR ACCOUNTANT");
  });

  it("builds the lookup using normalizeTitle() semantics", async () => {
    const duplicateChain = selectChain([duplicateMatch("DRAFT")]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    await createCuratedJob(
      staffActor("ADMIN"),
      validInput({ title: "--- Senior Accountant, " }),
    );
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain("Senior Accountant");
    expect(params).not.toContain("--- Senior Accountant, ");
  });

  it("omits the warning when no duplicate exists", async () => {
    const duplicateChain = selectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
  });

  it("scopes the duplicate lookup to the job's own organization", async () => {
    const duplicateChain = selectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain(ORG_ID);
    // never wildcard-scopes across organizations
    expect(params).not.toContain(OTHER_ORG_ID);
  });

  it("does not warn when the existing job is in a different location", async () => {
    const duplicateChain = selectChain([]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(
      staffActor("ADMIN"),
      validInput({ locationId: LOCATION_A }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toBeUndefined();
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain(LOCATION_A);
    expect(params).not.toContain(LOCATION_B);
  });

  it("warns when both jobs have a null location", async () => {
    const duplicateChain = selectChain([duplicateMatch("DRAFT")]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning?.matchedJobId).toBe(
        MATCHED_JOB_ID,
      );
    }
    const params = collectSqlParams(duplicateChain.where.mock.calls[0][0]);
    expect(params).toContain("Senior Accountant");
    expect(params).toContain(ORG_ID);
    expect(duplicateChain.where).toHaveBeenCalledTimes(1);
  });

  it.each(["EXPIRED", "REMOVED"] as const)(
    "does not warn when the only match is %s",
    async (status) => {
      const duplicateChain = selectChain([duplicateMatch(status)]);
      const tx = buildWarningTxChain(duplicateChain);
      runWithTx(tx);
      const result = await createCuratedJob(staffActor("ADMIN"), validInput());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.warning).toBeUndefined();
      }
    },
  );

  it("does not block creation and still creates DRAFT + PENDING", async () => {
    const duplicateChain = selectChain([duplicateMatch("PUBLISHED")]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.id).toBe(createdJobRow().id);
      expect(result.item.status).toBe("DRAFT");
      expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
    }
    const { job, jobSource } = capturedInserts(tx);
    expect(job.status).toBe("DRAFT");
    expect(job.verificationStatus).toBe("PENDING");
    expect(jobSource.jobId).toBe(createdJobRow().id);
  });

  it("warning carries the full matched-job contract", async () => {
    const duplicateChain = selectChain([
      duplicateMatch("PENDING_REVIEW", { title: "Nurse" }),
    ]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning).toEqual({
        code: "POSSIBLE_DUPLICATE",
        message: "Possible duplicate — review existing jobs before publishing.",
        matchedJobId: MATCHED_JOB_ID,
        matchedJobTitle: "Nurse",
        matchedStatus: "PENDING_REVIEW",
      });
    }
  });

  it("reports the newest eligible match via ORDER BY updatedAt/createdAt DESC + LIMIT 1", async () => {
    const duplicateChain = selectChain([
      duplicateMatch("PUBLISHED", { id: MATCHED_JOB_ID }),
    ]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warning?.matchedJobId).toBe(
        MATCHED_JOB_ID,
      );
    }
    expect(duplicateChain.orderBy).toHaveBeenCalledTimes(1);
    expect(duplicateChain.orderBy.mock.calls[0]).toHaveLength(2);
    expect(duplicateChain.limit).toHaveBeenCalledWith(1);
  });

  it("keeps provenance atomic when a warning is raised", async () => {
    const duplicateChain = selectChain([duplicateMatch("PUBLISHED")]);
    const tx = buildWarningTxChain(duplicateChain);
    runWithTx(tx);
    const result = await createCuratedJob(staffActor("ADMIN"), validInput());
    expect(result.ok).toBe(true);
    const { jobSource, audit } = capturedInserts(tx);
    expect(tx.insert).toHaveBeenCalledTimes(3); // job + job_source + audit
    expect(jobSource.sourceId).toBe(SOURCE_ID);
    expect(audit.action).toBe("JOB_CREATED");
  });
});