import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockOrganizationsFindFirst: vi.fn(),
  mockCategoriesFindFirst: vi.fn(),
  mockLocationsFindFirst: vi.fn(),
  mockJobSourcesFindFirst: vi.fn(),
  mockJobsFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      organizations: {
        findFirst: (...a: unknown[]) => mocks.mockOrganizationsFindFirst(...a),
      },
      categories: {
        findFirst: (...a: unknown[]) => mocks.mockCategoriesFindFirst(...a),
      },
      locations: {
        findFirst: (...a: unknown[]) => mocks.mockLocationsFindFirst(...a),
      },
      jobSources: {
        findFirst: (...a: unknown[]) => mocks.mockJobSourcesFindFirst(...a),
      },
      jobs: {
        findFirst: (...a: unknown[]) => mocks.mockJobsFindFirst(...a),
      },
    },
    transaction: (...a: unknown[]) => mocks.mockTransaction(...a),
  },
}));

vi.mock("@/lib/auth/roles", () => ({
  isStaffRole: (role: string) =>
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "MODERATOR",
}));

import { createCuratedJob } from "@/lib/admin/curatedJobs";
import { validateJobForPublish, moderateJob } from "@/lib/admin/jobs";
import { normalizeTitle } from "@/lib/normalization";
import {
  MANUAL_SOURCE_NAME,
  internalProvenanceUrl,
} from "@/lib/sources/provenance";
import { employerCreateJobSchema } from "@/lib/validations/employerJob";
import type { EmployerCreateJobInput } from "@/lib/validations/employerJob";
import type { AuthUser } from "@/lib/auth/roles";
import {
  REFERENCE_INVENTORY,
  type ReferenceInventoryRecord,
} from "./fixtures/referenceInventory";

type JobRow = (typeof import("@/db/schema/jobs").jobs)["$inferSelect"];

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SOURCE_ID = "55555555-5555-4555-8555-555555555555";
const JOB_ID = "44444444-4444-4444-8444-444444444444";
const DAY_MS = 24 * 60 * 60 * 1000;

function staffActor(role: AuthUser["role"]): AuthUser {
  return { id: ACTOR_ID, email: "staff@example.com", name: "Staff", role };
}

/** Maps a reference record to a publish-ready curated creation input. */
function recordInput(
  record: ReferenceInventoryRecord,
  overrides: Record<string, unknown> = {},
): EmployerCreateJobInput {
  return {
    organizationId: record.fixtureIds.organizationId,
    title: record.title,
    description: record.description,
    categoryId: record.fixtureIds.categoryId,
    professionId: record.fixtureIds.professionId,
    locationId: record.fixtureIds.locationId,
    employmentType: record.employmentType,
    responsibilities: record.responsibilities,
    requirements: record.requirements,
    educationRequirements: record.educationRequirements,
    deadline: new Date(Date.now() + record.deadlineDays * DAY_MS).toISOString(),
    applicationUrl: record.applicationUrl,
    ...overrides,
  } as EmployerCreateJobInput;
}

/** Maps a reference record to the job row the publication gate validates. */
function recordJobRow(
  record: ReferenceInventoryRecord,
  overrides: Record<string, unknown> = {},
): JobRow {
  return {
    id: JOB_ID,
    title: record.title,
    slug: "inventory-demo",
    organizationId: record.fixtureIds.organizationId,
    categoryId: record.fixtureIds.categoryId,
    professionId: record.fixtureIds.professionId,
    locationId: record.fixtureIds.locationId,
    description: record.description,
    responsibilities: record.responsibilities,
    requirements: record.requirements,
    educationRequirements: record.educationRequirements,
    benefits: null,
    experienceMin: null,
    experienceMax: null,
    employmentType: record.employmentType,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    postedAt: null,
    deadline: new Date(Date.now() + record.deadlineDays * DAY_MS),
    applicationUrl: record.applicationUrl,
    status: "DRAFT",
    verificationStatus: "PENDING",
    firstSeenAt: new Date(),
    lastVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as JobRow;
}

// ---------------------------------------------------------------------------
// Query/insert mocks mirroring src/lib/admin/__tests__/curatedJobs.test.ts.
// ---------------------------------------------------------------------------

function selectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

function insertChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi
    .fn()
    .mockResolvedValue(Array.isArray(result) ? result : [result]);
  return chain;
}

function createdJobRow(record: ReferenceInventoryRecord) {
  return {
    id: JOB_ID,
    title: record.title,
    slug: "inventory-demo",
    organizationId: record.fixtureIds.organizationId,
  };
}

/** Select order matches createCuratedJob: dup lookup, Manual source, 3 inserts. */
function buildCreateTx(
  record: ReferenceInventoryRecord,
  duplicate: { id: string; title: string; status: string } | null = null,
) {
  return {
    select: vi
      .fn()
      .mockReturnValueOnce(selectChain(duplicate ? [duplicate] : []))
      .mockReturnValueOnce(selectChain([{ id: SOURCE_ID }])),
    insert: vi
      .fn()
      .mockReturnValueOnce(insertChain(createdJobRow(record)))
      .mockReturnValueOnce(insertChain(undefined))
      .mockReturnValueOnce(insertChain(undefined)),
  };
}

function capturedInserts(tx: { insert: ReturnType<typeof vi.fn> }) {
  return {
    job: tx.insert.mock.results[0].value.values.mock.calls[0][0],
    jobSource: tx.insert.mock.results[1].value.values.mock.calls[0][0],
    audit: tx.insert.mock.results[2].value.values.mock.calls[0][0],
  };
}

function runWithTx(tx: unknown) {
  mocks.mockTransaction.mockImplementation(
    (cb: (t: unknown) => Promise<unknown>) => cb(tx),
  );
}

function makeTxMocks() {
  const capturedSets: Record<string, unknown>[] = [];
  const capturedAudits: Record<string, unknown>[] = [];
  mocks.mockUpdate.mockImplementation(() => ({
    set: (values: Record<string, unknown>) => {
      capturedSets.push(values);
      return { where: () => Promise.resolve() };
    },
  }));
  mocks.mockInsert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => {
      capturedAudits.push(values);
      return { returning: async () => [] };
    },
  }));
  return { capturedSets, capturedAudits };
}

function setupValidPublicationMocks(record: ReferenceInventoryRecord) {
  mocks.mockOrganizationsFindFirst.mockResolvedValue({
    id: record.fixtureIds.organizationId,
    status: "ACTIVE",
  });
  mocks.mockCategoriesFindFirst.mockResolvedValue({
    id: record.fixtureIds.categoryId,
    isActive: true,
  });
  mocks.mockLocationsFindFirst.mockResolvedValue({
    id: record.fixtureIds.locationId,
    isActive: true,
  });
  mocks.mockJobSourcesFindFirst.mockResolvedValue({ id: "prov-row" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reference inventory — static content standards (Batch 4)", () => {
  it("stays small and is explicitly designated demo (never production content)", () => {
    expect(REFERENCE_INVENTORY.length).toBeGreaterThan(0);
    expect(REFERENCE_INVENTORY.length).toBeLessThanOrEqual(10);

    for (const record of REFERENCE_INVENTORY) {
      expect(record.demo).toBe(true);
      expect(record.organizationName).toMatch(/^\[Demo\]/);
      // No source selection is invented or exposed anywhere in the inventory.
      expect(record).not.toHaveProperty("source");
      expect(record).not.toHaveProperty("sourceId");
      expect(MANUAL_SOURCE_NAME).toBe("Manual Entry");
      // EXTERNAL records use reserved example.com placeholders only; no fake
      // third-party application URLs are claimed.
      if (record.applicationMethod === "EXTERNAL") {
        expect(record.applicationUrl).toMatch(/^https:\/\/example\.com\//);
      } else {
        expect(record.applicationUrl).toBeNull();
      }
    }
  });

  it("diversifies categories, professions, locations, organizations and employment types", () => {
    const categories = new Set(REFERENCE_INVENTORY.map((r) => r.categoryName));
    const professions = new Set(
      REFERENCE_INVENTORY.map((r) => r.professionName).filter(
        (p): p is string => p !== null,
      ),
    );
    const locations = new Set(REFERENCE_INVENTORY.map((r) => r.locationName));
    const organizations = new Set(
      REFERENCE_INVENTORY.map((r) => r.organizationName),
    );
    const employmentTypes = new Set(
      REFERENCE_INVENTORY.map((r) => r.employmentType),
    );

    expect(categories.size).toBeGreaterThanOrEqual(3);
    expect(professions.size).toBeGreaterThanOrEqual(3);
    expect(locations.size).toBeGreaterThanOrEqual(3);
    expect(organizations.size).toBeGreaterThanOrEqual(3);
    expect(employmentTypes.size).toBeGreaterThanOrEqual(3);
  });

  it("introduces no obvious duplicate and only future, realistic deadlines", () => {
    const keys = REFERENCE_INVENTORY.map(
      (r) =>
        `${r.fixtureIds.organizationId}|${normalizeTitle(r.title).toLowerCase()}|${r.fixtureIds.locationId}`,
    );
    expect(new Set(keys).size).toBe(keys.length);

    for (const record of REFERENCE_INVENTORY) {
      expect(record.title.trim().length).toBeGreaterThan(0);
      expect(record.description.length).toBeGreaterThanOrEqual(50);
      // Realistic, never-past deadlines: between one week and four months out.
      expect(record.deadlineDays).toBeGreaterThanOrEqual(7);
      expect(record.deadlineDays).toBeLessThanOrEqual(120);
    }
  });
});

describe("reference inventory — curated workflow safety (Batch 4)", () => {
  it.each(REFERENCE_INVENTORY)(
    "$title — creation writes exactly one Manual Entry provenance row and never accepts a client source",
    async (record) => {
      const tx = buildCreateTx(record);
      runWithTx(tx);
      const input = recordInput(record);

      const result = await createCuratedJob(staffActor("ADMIN"), input);

      expect(result.ok).toBe(true);
      const { job, jobSource, audit } = capturedInserts(tx);
      expect(job.status).toBe("DRAFT");
      expect(job.verificationStatus).toBe("PENDING");
      expect(jobSource.sourceId).toBe(SOURCE_ID);
      expect(jobSource.sourceUrl).toBe(internalProvenanceUrl(SOURCE_ID));
      expect(jobSource.externalId).toBeNull();
      expect(jobSource.rawHash).toBeNull();
      expect(audit.metadata.source).toBe("manual");
      // No client-controlled source fields can reach the provenance write.
      expect(input).not.toHaveProperty("sourceId");
      expect(input).not.toHaveProperty("sourceType");
    },
  );

  it.each(REFERENCE_INVENTORY)(
    "$title — passes publication validation with provenance attached",
    async (record) => {
      setupValidPublicationMocks(record);

      const result = await validateJobForPublish(recordJobRow(record));
      expect(result.ok).toBe(true);
    },
  );

  it("publishing a fixture-derived record stamps PUBLISHED + VERIFIED + lastVerifiedAt", async () => {
    const record = REFERENCE_INVENTORY[0];
    setupValidPublicationMocks(record);
    mocks.mockJobsFindFirst.mockResolvedValue(
      recordJobRow(record, { status: "PENDING_REVIEW" }),
    );
    const { capturedSets, capturedAudits } = makeTxMocks();
    runWithTx({ update: mocks.mockUpdate, insert: mocks.mockInsert });

    const result = await moderateJob(JOB_ID, "PUBLISH", ACTOR_ID);

    expect(result.ok).toBe(true);
    expect(capturedSets[0].status).toBe("PUBLISHED");
    expect(capturedSets[0].verificationStatus).toBe("VERIFIED");
    expect(capturedSets[0].lastVerifiedAt).toBeInstanceOf(Date);
    expect(capturedAudits[0].action).toBe("JOB_PUBLISHED");
  });

  it("rejects a past deadline (no expired or stale listings can be published)", async () => {
    const record = REFERENCE_INVENTORY[0];
    setupValidPublicationMocks(record);

    const result = await validateJobForPublish(
      recordJobRow(record, { deadline: new Date("2020-01-01") }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "INCOMPLETE_DATA") {
      expect(result.missingFields).toContain("deadline");
    }
  });

  it("blocks publish when provenance is missing (source is never bypassed)", async () => {
    const record = REFERENCE_INVENTORY[0];
    setupValidPublicationMocks(record);
    mocks.mockJobSourcesFindFirst.mockResolvedValue(undefined);

    const result = await validateJobForPublish(recordJobRow(record));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_PROVENANCE");
    }
  });

  it("raises a WARN-only duplicate warning but never blocks creation", async () => {
    const record = REFERENCE_INVENTORY[0];
    const tx = buildCreateTx(record, {
      id: "99999999-9999-4999-8999-999999999999",
      title: record.title,
      status: "PUBLISHED",
    });
    runWithTx(tx);

    const result = await createCuratedJob(
      staffActor("ADMIN"),
      recordInput(record),
    );

    expect(result.ok).toBe(true);
    expect(tx.insert).toHaveBeenCalledTimes(3); // warning did not block
    if (result.ok) {
      expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
      expect(result.warning?.matchedJobTitle).toBe(record.title);
    }
  });

  it("strict schema rejects any client-supplied source field", () => {
    const parsed = employerCreateJobSchema.safeParse(
      recordInput(REFERENCE_INVENTORY[0], {
        sourceId: "should-not-pass",
      }),
    );
    expect(parsed.success).toBe(false);
  });
});