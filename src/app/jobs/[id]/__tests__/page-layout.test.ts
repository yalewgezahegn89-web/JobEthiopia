import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockFetchJobById: vi.fn(),
  mockFetchJobs: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockIsJobSaved: vi.fn(),
  mockSelectRelatedJobs: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(
      Fragment,
      null,
      createElement("a", { href, "data-testid": href }, children),
    ),
}));

vi.mock("@/lib/jobs/public", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/public")>();
  return {
    ...actual,
    fetchJobById: (...a: unknown[]) => mocks.mockFetchJobById(...a),
    fetchJobs: (...a: unknown[]) => mocks.mockFetchJobs(...a),
  };
});

vi.mock("@/lib/jobs/related", () => ({
  selectRelatedJobs: (...a: unknown[]) => mocks.mockSelectRelatedJobs(...a),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...a: unknown[]) => mocks.mockGetCurrentUser(...a),
}));

vi.mock("@/lib/savedJobs/dal", () => ({
  isJobSaved: (...a: unknown[]) => mocks.mockIsJobSaved(...a),
}));

vi.mock("@/components/job-share", () => ({
  default: ({ title }: { title: string }) =>
    createElement("span", { "data-testid": "job-share" }, `Share:${title}`),
}));

vi.mock("@/components/applications/apply-button", () => ({
  ApplyButton: ({ jobId }: { jobId: string }) =>
    createElement("button", { "data-apply-job": jobId }, "Apply Now"),
}));

vi.mock("@/components/saved-jobs/save-button", () => ({
  SaveButton: ({ jobId }: { jobId: string }) =>
    createElement("button", { "data-save-job": jobId }, "Save"),
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
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    categoryName: "Finance",
    professionName: "Accounting",
    employmentType: "FULL_TIME",
    description: "We are looking for a skilled accountant to join our team.",
    responsibilities: "Prepare financial statements.\nManage ledgers.",
    requirements: "5+ years experience.\nCPA preferred.",
    educationRequirements: "Bachelor's degree in Accounting.",
    benefits: "Health insurance.\nPaid leave.",
    experienceMin: 5,
    experienceMax: 10,
    salaryText: "30,000 - 45,000 ETB",
    deadlineText: "Mar 15, 2099",
    deadline: "2099-03-15T00:00:00.000Z",
    postedAt: "2026-01-01T00:00:00.000Z",
    applicationUrl: null,
    verificationStatus: "VERIFIED",
    lastVerifiedAt: "2026-01-02T00:00:00.000Z",
    firstSeenAt: null,
    createdAt: null,
    status: "PUBLISHED",
    ...overrides,
  } as const;
}

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-9",
    title: "Junior Analyst",
    slug: "junior-analyst",
    organizationId: null,
    categoryId: null,
    professionId: null,
    locationId: null,
    organizationName: "Beta Ltd",
    locationName: "Dire Dawa",
    categoryName: null,
    professionName: null,
    employmentType: "FULL_TIME",
    salaryText: null,
    deadlineText: null,
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    verificationStatus: null,
    status: "PUBLISHED",
    ...overrides,
  };
}

async function renderJob(): Promise<string> {
  const element = await JobPage({ params: Promise.resolve({ id: JOB_ID }) });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockFetchJobById.mockResolvedValue(makeJob());
  mocks.mockFetchJobs.mockResolvedValue({
    items: [makeSummary()],
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  });
  mocks.mockSelectRelatedJobs.mockReturnValue([makeSummary()]);
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockIsJobSaved.mockResolvedValue(false);
});

describe("JobPage layout", () => {
  it("renders a breadcrumb with Home, Jobs, and the job title", async () => {
    const html = await renderJob();
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/jobs"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Senior Accountant");
  });

  it("renders the job title as a single H1", async () => {
    const html = await renderJob();
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).toContain("<h1");
    expect(html).toContain("Senior Accountant");
  });

  it("renders organization identity with initials", async () => {
    const html = await renderJob();
    expect(html).toContain("ACME Plc");
    expect(html).toContain("AC");
  });

  it("renders the verified state with success badge", async () => {
    const html = await renderJob();
    expect(html).toContain("Verified");
    expect(html).toContain("bg-success-light");
  });

  it("does not show verified state when not verified", async () => {
    mocks.mockFetchJobById.mockResolvedValue(makeJob({ verificationStatus: null, lastVerifiedAt: null }));
    const html = await renderJob();
    expect(html).not.toContain("Verified");
  });

  it("renders key metadata (location, type, category, profession, salary)", async () => {
    const html = await renderJob();
    expect(html).toContain("Addis Ababa");
    expect(html).toContain("FULL TIME");
    expect(html).toContain("Finance");
    expect(html).toContain("Accounting");
    expect(html).toContain("30,000 - 45,000 ETB");
  });

  it("marks an open job as Open and shows deadline warning for closing jobs", async () => {
    const html = await renderJob();
    expect(html).toContain("Deadline:");
    expect(html).toContain("Mar 15, 2099");
  });

  it("shows a closing-soon amber treatment for jobs closing within 7 days", async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ deadline: future, deadlineText: "Closing soon" }),
    );
    const html = await renderJob();
    expect(html).toContain("Closing soon");
    expect(html).toContain("bg-warning-light");
  });

  it("shows an expired destructive treatment and no apply CTA for expired jobs", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ status: "EXPIRED", deadline: "2020-01-01T00:00:00.000Z", deadlineText: "Mar 1, 2020" }),
    );
    const html = await renderJob();
    expect(html).toContain("Expired");
    expect(html).toContain("bg-destructive-light");
    expect(html).toContain("no longer accepting");
    expect(html).not.toContain("data-apply-job");
    expect(html).not.toContain("data-save-job");
  });

  it("renders content sections only when content exists", async () => {
    const html = await renderJob();
    expect(html).toContain("About the role");
    expect(html).toContain("Responsibilities");
    expect(html).toContain("Requirements");
    expect(html).toContain("Qualifications");
    expect(html).toContain("Benefits");
    expect(html).toContain("We are looking for a skilled accountant");
  });

  it("omits empty content sections", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ benefits: null, responsibilities: null }),
    );
    const html = await renderJob();
    expect(html).not.toContain("Benefits");
    expect(html).not.toContain("Responsibilities");
    expect(html).toContain("Requirements");
  });

  it("renders content safely without unsafe HTML", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ description: "Line one\n<b>not bold</b>" }),
    );
    const html = await renderJob();
    expect(html).toContain("Line one");
    expect(html).not.toContain("<b>not bold</b>");
    expect(html).toContain("&lt;b&gt;not bold&lt;/b&gt;");
  });

  it("renders related jobs using JobCard under an honest label", async () => {
    const html = await renderJob();
    expect(html).toContain("More opportunities");
    expect(html).toContain("Junior Analyst");
    expect(html).toContain('href="/jobs/job-9"');
  });

  it("does not render related jobs when there are none", async () => {
    mocks.mockSelectRelatedJobs.mockReturnValue([]);
    const html = await renderJob();
    expect(html).not.toContain("More opportunities");
  });

  it("shows an external apply CTA with target and rel for external jobs", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ applicationUrl: "https://external.example.com/apply" }),
    );
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const html = await renderJob();
    expect(html).toContain("Apply on employer site");
    expect(html).toContain('href="https://external.example.com/apply"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("data-apply-job");
  });

  it("shows a How to apply source section for external jobs", async () => {
    mocks.mockFetchJobById.mockResolvedValue(
      makeJob({ applicationUrl: "https://external.example.com/apply" }),
    );
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const html = await renderJob();
    expect(html).toContain("How to apply");
  });

  it("includes a JobPosting JSON-LD script when all required data is available", async () => {
    const html = await renderJob();
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("JobPosting");
    expect(html).toContain("validThrough");
    expect(html).toContain("ACME Plc");
    expect(html).toContain("Addis Ababa");
  });

  it("omits JSON-LD when required fields are missing", async () => {
    mocks.mockFetchJobById.mockResolvedValue(makeJob({ locationName: null, organizationName: null }));
    const html = await renderJob();
    expect(html).not.toContain('type="application/ld+json"');
  });

  it("renders an error state when loading fails", async () => {
    mocks.mockFetchJobById.mockRejectedValue(new Error("boom"));
    const html = await renderJob();
    expect(html).toContain("We could not load this job");
    expect(html).toContain("Back to Jobs");
  });

  it("shows Apply and Save controls for a candidate on an open published job", async () => {
    const html = await renderJob();
    expect(html).toContain('data-apply-job="');
    expect(html).toContain('data-save-job="');
  });

  it("does not show internal Apply for a non-candidate", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    const html = await renderJob();
    expect(html).not.toContain("data-apply-job");
  });
});
