import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockActiveOrgs: vi.fn(),
  mockWhere: vi.fn(),
  mockResults: vi.fn(),
  mockEligibility: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      organizations: {
        findMany: (...a: unknown[]) => mocks.mockActiveOrgs(...a),
      },
    },
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: (where: unknown) => {
                mocks.mockWhere(where);
                return {
                  orderBy: () => ({
                    limit: () => mocks.mockResults(),
                  }),
                };
              },
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/jobs/eligibility", () => ({
  buildPublicJobEligibilityConditions: (...a: unknown[]) =>
    mocks.mockEligibility(...a),
}));

import { splitAlertKeywords, matchJobsForAlert } from "@/lib/jobAlerts/matching";
import type { JobAlertRow } from "@/lib/jobAlerts/dal";

function alert(overrides: Record<string, unknown> = {}): JobAlertRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "Alert",
    keywords: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    employmentType: null,
    frequency: "DAILY",
    locale: "en",
    status: "ACTIVE",
    unsubscribeTokenHash: null,
    unsubscribeTokenExpiresAt: null,
    lastSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function matched(id: string) {
  return {
    id,
    title: "Example job",
    slug: "example-job",
    organizationId: "org-1",
    organizationName: "Org",
    locationId: "loc-1",
    locationName: "Addis Ababa",
    employmentType: "FULL_TIME",
    description: null,
    postedAt: new Date(),
    deadline: null,
  };
}

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

function lastWhere(): string {
  return flattenWhere(mocks.mockWhere.mock.calls[0][0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockEligibility.mockResolvedValue([]);
  mocks.mockResults.mockResolvedValue([matched("job-1")]);
});

describe("splitAlertKeywords", () => {
  it("splits on whitespace and commas and lowercases", () => {
    expect(splitAlertKeywords(" Auditor , IFRS\texcel ")).toEqual([
      "auditor",
      "ifrs",
      "excel",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(splitAlertKeywords("")).toEqual([]);
    expect(splitAlertKeywords(null)).toEqual([]);
    expect(splitAlertKeywords(undefined)).toEqual([]);
  });
});

describe("matchJobsForAlert", () => {
  it("bases queries on the shared public eligibility helper", async () => {
    await matchJobsForAlert(alert());
    expect(mocks.mockEligibility).toHaveBeenCalledOnce();
  });

  it("excludes jobs already delivered for the alert", async () => {
    await matchJobsForAlert(alert());
    expect(lastWhere()).toContain("is null");
  });

  it("restricts to provided job ids for instant delivery", async () => {
    await matchJobsForAlert(alert(), { restrictJobIds: ["job-9"] });
    expect(lastWhere()).toContain("job-9");
  });

  it("applies set filters", async () => {
    await matchJobsForAlert(
      alert({
        categoryId: "cat-1",
        professionId: "prof-1",
        locationId: "loc-1",
        employmentType: "FULL_TIME",
      }),
    );
    const where = lastWhere();
    expect(where).toContain("cat-1");
    expect(where).toContain("prof-1");
    expect(where).toContain("loc-1");
    expect(where).toContain("full_time");
  });

  it("renders LIKE patterns for keyword tokens", async () => {
    await matchJobsForAlert(alert({ keywords: "auditor ifrs" }));
    const where = lastWhere();
    expect(where).toContain("%auditor%");
    expect(where).toContain("%ifrs%");
  });
});