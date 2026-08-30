import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockFetchJobById: vi.fn(),
  mockFetchJobs: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobById: (...a: unknown[]) => mocks.mockFetchJobById(...a),
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...a: unknown[]) => mocks.mockGetCurrentUser(...a),
}));

vi.mock("@/components/job-share", () => ({
  default: () => createElement("div", null, "share"),
}));

vi.mock("@/components/applications/apply-button", () => ({
  ApplyButton: ({ jobId }: { jobId: string }) => createElement("button", { "data-apply-job": jobId }, "ApplyNow"),
}));

import JobPage from "@/app/jobs/[id]/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    title: "Accountant",
    slug: "accountant",
    organizationName: "ACME Plc",
    locationName: null,
    categoryName: null,
    professionName: null,
    employmentType: null,
    description: "desc",
    responsibilities: null,
    requirements: null,
    educationRequirements: null,
    benefits: null,
    experienceMin: null,
    experienceMax: null,
    salaryText: null,
    deadlineText: null,
    deadline: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    applicationUrl: null,
    verificationStatus: null,
    lastVerifiedAt: null,
    firstSeenAt: null,
    createdAt: null,
    status: "PUBLISHED",
    ...overrides,
  } as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchJobById.mockResolvedValue(makeJob());
  mocks.mockFetchJobs.mockResolvedValue({ items: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } });
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
});

describe("JobPage apply CTA", () => {
  it("renders the internal ApplyButton for an open, internal job as a candidate", async () => {
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const childElements = collectElements(element);
    expect(childElements.some((e) => e.props["jobId"] === JOB_ID)).toBe(true);
  });

  it("does not render the internal ApplyButton when the user is not a candidate", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const buttons = collectElements(element);
    expect(buttons.some((e) => e.props["data-apply-job"] === JOB_ID)).toBe(false);
  });

  it("does not render the internal ApplyButton when the job has an external application URL", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ applicationUrl: "https://external.example.com/apply" }),
    );
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const buttons = collectElements(element);
    expect(buttons.some((e) => e.props["data-apply-job"] === JOB_ID)).toBe(false);
  });

  it("does not render the internal ApplyButton for an expired job", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ status: "EXPIRED", deadline: "2020-01-01T00:00:00.000Z" }),
    );
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const buttons = collectElements(element);
    expect(buttons.some((e) => e.props["data-apply-job"] === JOB_ID)).toBe(false);
  });

  it("renders notFound for a missing job", async () => {
    mocks.mockFetchJobById.mockResolvedValue(null);
    await expect(JobPage({ params: Promise.resolve({ id: JOB_ID }) })).rejects.toThrow("NOT_FOUND");
  });
});

function collectElements(node: unknown, acc: Array<{ type: unknown; props: Record<string, unknown> }> = []): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (!node || typeof node !== "object") return acc;
  const n = node as { type?: unknown; props?: Record<string, unknown> & { children?: unknown } };
  if (typeof n.type !== "undefined") {
    acc.push({ type: n.type, props: n.props ?? {} });
  }
  const children = n.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) collectElements(child, acc);
  } else if (children != null && typeof children === "object") {
    collectElements(children, acc);
  }
  return acc;
}
