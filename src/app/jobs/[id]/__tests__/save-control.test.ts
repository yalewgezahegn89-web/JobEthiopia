import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockFetchJobById: vi.fn(),
  mockFetchJobs: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockIsJobSaved: vi.fn(),
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

vi.mock("@/lib/savedJobs/dal", () => ({
  isJobSaved: (...a: unknown[]) => mocks.mockIsJobSaved(...a),
}));

vi.mock("@/components/job-share", () => ({
  default: () => createElement("div", null, "share"),
}));

vi.mock("@/components/applications/apply-button", () => ({
  ApplyButton: ({ jobId }: { jobId: string }) => createElement("button", { "data-apply-job": jobId }, "ApplyNow"),
}));

vi.mock("@/components/saved-jobs/save-button", () => ({
  SaveButton: ({ jobId, initialSaved }: { jobId: string; initialSaved: boolean }) =>
    createElement("span", { "data-testid": `save-${jobId}`, "data-saved": initialSaved }, "Save"),
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
  mocks.mockIsJobSaved.mockResolvedValue(false);
});

describe("JobPage save control", () => {
  it("renders a Save control for an authenticated candidate on a PUBLISHED job", async () => {
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const save = findSaveButton(element);
    expect(save).toBeDefined();
    expect(save!.props["initialSaved"]).toBe(false);
    expect(mocks.mockIsJobSaved).toHaveBeenCalledWith(CANDIDATE.id, JOB_ID);
  });

  it("passes the server-derived saved state (true) to the Save control", async () => {
    mocks.mockIsJobSaved.mockResolvedValue(true);
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    const save = findSaveButton(element);
    expect(save!.props["initialSaved"]).toBe(true);
  });

  it("does not render a save control for a non-candidate", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    expect(findSaveButton(element)).toBeUndefined();
    expect(mocks.mockIsJobSaved).not.toHaveBeenCalled();
  });

  it("does not render a save control for a non-PUBLISHED job", async () => {
    mocks.mockFetchJobById.mockResolvedValue(makeJob({ status: "DRAFT" }));
    const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
    expect(findSaveButton(element)).toBeUndefined();
  });
});

function findSaveButton(node: unknown): { props: Record<string, unknown> } | undefined {
  return collectElements(node).find((e) => e.props["jobId"] === JOB_ID && "initialSaved" in e.props);
}

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
