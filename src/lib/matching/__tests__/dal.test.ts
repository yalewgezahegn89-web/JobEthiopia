import { describe, it, expect, vi, beforeEach } from "vitest";
import { sql } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  queue: {} as Record<string, unknown[][]>,
  mockWhere: vi.fn(),
  mockEligibility: vi.fn(),
}));

vi.mock("@/db", () => {
  const nameOf = (table: unknown): string | null => {
    if (table == null || typeof table !== "object") return null;
    const value = (table as Record<symbol, unknown>)[Symbol.for("drizzle:Name")];
    return typeof value === "string" ? value : null;
  };
  const take = (name: string): unknown[] => {
    const q = mocks.queue[name];
    if (!Array.isArray(q) || q.length === 0) return [];
    const next = q.shift();
    return Array.isArray(next) ? next : [];
  };
  const chain = (name: string): Record<string, unknown> => ({
    innerJoin: () => chain(name),
    leftJoin: () => chain(name),
    where: (where: unknown) => {
      mocks.mockWhere(where);
      return chain(name);
    },
    orderBy: () => chain(name),
    limit: () => chain(name),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason?: unknown) => unknown,
    ) => Promise.resolve(take(name)).then(resolve, reject),
  });
  const findFirst = (name: string) => async (): Promise<unknown> => {
    const rows = take(name);
    return rows.length > 0 ? rows[0] : undefined;
  };
  return {
    db: {
      query: {
        candidateProfiles: { findFirst: findFirst("candidate_profiles") },
        candidateCvs: { findFirst: findFirst("candidate_cvs") },
        locations: { findFirst: findFirst("locations") },
      },
      select: () => ({
        from: (table: unknown) => chain(nameOf(table) ?? "unknown"),
      }),
    },
  };
});

vi.mock("@/lib/jobs/eligibility", () => ({
  buildPublicJobEligibilityConditions: (...args: unknown[]) =>
    mocks.mockEligibility(...args),
}));

import { getCandidateRecommendations } from "@/lib/matching/dal";

const CANDIDATE_ID = "11111111-1111-4111-8111-111111111111";

function flattenWhere(node: unknown): string {
  const parts: string[] = [];
  const walk = (current: unknown): void => {
    if (current == null) return;
    if (Array.isArray(current)) {
      for (const item of current) walk(item);
      return;
    }
    if (typeof current === "object") {
      const queryChunks = (current as { queryChunks?: unknown }).queryChunks;
      if (Array.isArray(queryChunks)) {
        for (const item of queryChunks) walk(item);
        return;
      }
      const value = (current as { value?: unknown }).value;
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
      } else if (typeof value !== "undefined") {
        parts.push(String(value));
      }
      return;
    }
    parts.push(String(current));
  };
  walk(node);
  return parts.join(" ").toLowerCase();
}

function allWhere(): string {
  return mocks.mockWhere.mock.calls.map((call) => flattenWhere(call[0])).join(" | ");
}

const NOW = new Date("2026-09-10T00:00:00.000Z");

function poolRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Accountant",
    slug: `${id}-slug`,
    organizationId: "org-1",
    categoryId: "cat1",
    professionId: "prof1",
    locationId: "locA",
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    locationParentId: "region1",
    categoryName: "Finance",
    professionName: "Accountant",
    employmentType: "FULL_TIME",
    experienceMin: 2,
    experienceMax: 6,
    description: "prepare financial statements",
    requirements: "SQL, Excel",
    educationRequirements: "BA degree",
    deadline: null,
    postedAt: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    verificationStatus: "VERIFIED",
    status: "PUBLISHED",
    salaryMin: "20000",
    salaryMax: "30000",
    salaryCurrency: "ETB",
    salaryPeriod: "MONTHLY",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockEligibility.mockResolvedValue([sql`1 = 1`]);
  mocks.queue = {
    candidate_profiles: [[{ locationId: "locA", totalExperienceYears: 4 }]],
    job_alerts: [
      [
        {
          categoryId: "cat1",
          professionId: "prof1",
          locationId: "locA",
          employmentType: "FULL_TIME",
        },
      ],
    ],
    saved_jobs: [[{ jobId: "job-saved" }], [{ jobId: "job-saved" }]],
    applications: [[{ jobId: "job-applied" }], [{ jobId: "job-applied" }]],
    candidate_cvs: [[{ id: "cv1" }]],
    jobs: [[], [poolRow("job-1")]],
    professions: [[{ id: "prof1", categoryId: "cat1" }]],
    candidate_cv_skills: [[{ name: "ReactJS" }, { name: "SQL" }]],
    locations: [[{ parentId: "region1" }]],
  };
});

describe("getCandidateRecommendations", () => {
  it("returns a strong match ranked above candidates that barely fit", async () => {
    mocks.queue.jobs = [
      [],
      [
        poolRow("job-1"),
        poolRow("job-2", {
          professionId: "prof9",
          locationId: "locZ",
          locationParentId: "region9",
          employmentType: "CONTRACT",
          postedAt: new Date("2026-05-01T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
      ],
    ];

    const items = await getCandidateRecommendations(CANDIDATE_ID, { now: NOW });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.job.id)).toEqual(["job-1", "job-2"]);
    expect(items[0].score).toBeGreaterThan(items[1].score);
    expect(items[0].score).toBeLessThanOrEqual(1);
  });

  it("excludes saved and applied jobs via the eligibility where clause", async () => {
    await getCandidateRecommendations(CANDIDATE_ID, { now: NOW });

    expect(mocks.mockEligibility).toHaveBeenCalledTimes(1);
    expect(allWhere()).toContain("job-saved");
    expect(allWhere()).toContain("job-applied");
  });

  it("returns empty recommendations for a candidate with no signals", async () => {
    mocks.queue = {
      candidate_profiles: [[]],
      job_alerts: [[]],
      saved_jobs: [[], []],
      applications: [[], []],
      candidate_cvs: [[]],
      jobs: [[], [poolRow("job-1")]],
      professions: [[]],
      candidate_cv_skills: [[]],
      locations: [[]],
    };

    const items = await getCandidateRecommendations(CANDIDATE_ID, { now: NOW });

    expect(items).toEqual([]);
  });

  it("respects the requested limit", async () => {
    mocks.queue.jobs = [
      [],
      [
        poolRow("job-1"),
        poolRow("job-2", {
          professionId: "prof9",
          locationId: "locZ",
          locationParentId: "region9",
          employmentType: "CONTRACT",
          postedAt: new Date("2026-05-01T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
      ],
    ];

    const items = await getCandidateRecommendations(CANDIDATE_ID, {
      now: NOW,
      limit: 1,
    });

    expect(items).toHaveLength(1);
    expect(items[0].job.id).toBe("job-1");
  });

  it("builds a public job summary from the pooled row", async () => {
    const items = await getCandidateRecommendations(CANDIDATE_ID, { now: NOW });

    const summary = items[0].job;
    expect(summary.organizationName).toBe("ACME Plc");
    expect(summary.locationName).toBe("Addis Ababa");
    expect(summary.categoryName).toBe("Finance");
    expect(summary.professionName).toBe("Accountant");
    expect(summary.verificationStatus).toBe("VERIFIED");
    expect(summary.salaryText).toBe("20,000 - 30,000 ETB / monthly");
  });

  it("returns carried match factors for the explanation", async () => {
    const items = await getCandidateRecommendations(CANDIDATE_ID, { now: NOW });

    const factors = items[0].factors;
    expect(factors).toHaveLength(6);
    expect(factors.find((f) => f.key === "location")).toMatchObject({ score: 1 });
    expect(factors.find((f) => f.key === "skills")).toMatchObject({ score: expect.any(Number) });
  });
});