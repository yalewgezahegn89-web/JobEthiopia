import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockListJobs: vi.fn(),
  mockGetJob: vi.fn(),
  mockGetAudit: vi.fn(),
  mockListActiveCategories: vi.fn(),
  mockNotFound: vi.fn(),
  mockFacebookPreview: vi.fn(),
  mockFacebookPublication: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
  usePathname: (): string => "/admin/jobs",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/jobs", () => ({
  listModerationJobs: (...args: unknown[]) => mocks.mockListJobs(...args),
  getModerationJob: (...args: unknown[]) => mocks.mockGetJob(...args),
  getJobAuditHistory: (...args: unknown[]) => mocks.mockGetAudit(...args),
  listActiveJobCategories: (...args: unknown[]) =>
    mocks.mockListActiveCategories(...args),
}));

vi.mock("@/lib/facebook/publishing", () => ({
  getFacebookPublishPreview: (...args: unknown[]) =>
    mocks.mockFacebookPreview(...args),
  getFacebookPublicationForJob: (...args: unknown[]) =>
    mocks.mockFacebookPublication(...args),
  OWNED_FACEBOOK_PAGE_ID: "872697352845055",
  OWNED_FACEBOOK_PAGE_NAME: "Job Ethiopia",
}));

import AdminJobsPage from "@/app/admin/jobs/page";
import AdminJobDetailPage from "@/app/admin/jobs/[id]/page";

const SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test Job",
  slug: "test-job",
  status: "PENDING_REVIEW",
  verificationStatus: "NEEDS_REVIEW",
  postedAt: "2026-01-01T00:00:00.000Z",
  deadline: null,
  lastVerifiedAt: null,
  organizationName: "Org",
  categoryName: null,
  professionName: null,
  locationName: null,
  sourceName: null,
};

const FULL_JOB = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test Job",
  slug: "test-job",
  status: "PENDING_REVIEW",
  verificationStatus: "PENDING",
  description: "A description",
  requirements: "req",
  responsibilities: null,
  benefits: null,
  employmentType: "FULL_TIME",
  salaryMin: "1000",
  salaryMax: "2000",
  salaryCurrency: "ETB",
  postedAt: new Date("2026-01-01T00:00:00.000Z"),
  deadline: null,
  applicationUrl: null,
  lastVerifiedAt: null,
  organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  categoryId: null,
  professionId: null,
  locationId: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
  mocks.mockFacebookPreview.mockResolvedValue(null);
  mocks.mockFacebookPublication.mockResolvedValue(null);
  mocks.mockListActiveCategories.mockResolvedValue([]);
});

describe("AdminJobsPage", () => {
  it("renders the queue for staff", async () => {
    mocks.mockListJobs.mockResolvedValue({
      items: [SUMMARY],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const element = await AdminJobsPage({ searchParams: Promise.resolve({}) });
    expect(element.type).toBe("div");
    expect(mocks.mockListJobs).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminJobsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      AdminJobsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockListJobs.mockRejectedValue(new Error("db down"));
    const element = await AdminJobsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("renders an empty queue", async () => {
    mocks.mockListJobs.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    const element = await AdminJobsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses page/status filters from search params", async () => {
    mocks.mockListJobs.mockResolvedValue({ items: [], page: 2, limit: 20, total: 0, totalPages: 1 });
    await AdminJobsPage({
      searchParams: Promise.resolve({ page: "2", status: "PENDING_REVIEW" }),
    });
    expect(mocks.mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, status: "PENDING_REVIEW" }),
    );
  });
});

describe("AdminJobDetailPage", () => {
  it("renders job detail with audit history for staff", async () => {
    mocks.mockGetJob.mockResolvedValue(FULL_JOB);
    mocks.mockGetAudit.mockResolvedValue([
      {
        id: "e1",
        action: "JOB_PUBLISHED",
        targetType: "job",
        targetId: FULL_JOB.id,
        metadata: { toStatus: "PUBLISHED" },
        createdAt: "2026-01-02T00:00:00.000Z",
        actorEmail: "admin@example.com",
      },
    ]);
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    expect(element).toBeTruthy();
    expect(mocks.mockGetAudit).toHaveBeenCalledWith(FULL_JOB.id);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      AdminJobDetailPage({ params: Promise.resolve({ id: FULL_JOB.id }) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("calls notFound for a missing job", async () => {
    mocks.mockGetJob.mockResolvedValue(null);
    await expect(
      AdminJobDetailPage({ params: Promise.resolve({ id: FULL_JOB.id }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockGetJob.mockRejectedValue(new Error("db down"));
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    expect(element).toBeTruthy();
  });
});

describe("AdminJobDetailPage — last verified + stale display", () => {
  function jobWith(
    overrides: Partial<Omit<typeof FULL_JOB, "lastVerifiedAt">> & {
      lastVerifiedAt?: Date | null;
    },
  ) {
    return { ...FULL_JOB, ...overrides };
  }

  async function renderDetail(job: unknown) {
    mocks.mockGetJob.mockResolvedValue(job);
    mocks.mockGetAudit.mockResolvedValue([]);
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    return renderToStaticMarkup(element);
  }

  it("displays a recent last verified timestamp for a fresh PUBLISHED job", async () => {
    const freshIso = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const expectedLabel = new Date(freshIso).toLocaleString();
    const html = await renderDetail(
      jobWith({
        status: "PUBLISHED",
        lastVerifiedAt: new Date(freshIso),
      }),
    );
    expect(html).toContain(expectedLabel);
    expect(html).not.toContain("Stale");
  });

  it("displays Never for a null lastVerifiedAt (and treats it as stale)", async () => {
    const html = await renderDetail(
      jobWith({ status: "PUBLISHED", lastVerifiedAt: null }),
    );
    expect(html).toContain("Never");
    expect(html).toContain("Stale");
  });

  it("shows Stale badge for PUBLISHED job with old lastVerifiedAt", async () => {
    const html = await renderDetail(
      jobWith({
        status: "PUBLISHED",
        lastVerifiedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    );
    expect(html).toContain("Stale");
    expect(html).toContain("bg-warning-light");
  });

  it("does not show Stale badge for a non-PUBLISHED job even with old lastVerifiedAt", async () => {
    const html = await renderDetail(
      jobWith({
        status: "DRAFT",
        lastVerifiedAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    );
    expect(html).not.toContain("Stale");
  });

  it("keeps the stored value and lifecycle status intact on the page", async () => {
    const freshIso = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const expectedLabel = new Date(freshIso).toLocaleString();
    const html = await renderDetail(
      jobWith({
        status: "PUBLISHED",
        lastVerifiedAt: new Date(freshIso),
      }),
    );
    expect(html).toContain("PUBLISHED");
    expect(html).toContain(expectedLabel);
  });

  it("renders the Facebook publish panel for a published job with a preview", async () => {
    mocks.mockFacebookPreview.mockResolvedValue({
      message: "Senior Pilot — Ethiopian Airlines",
      link: `https://jobethiopia.et/jobs/${FULL_JOB.id}`,
      status: "PUBLISHED",
      verificationStatus: "VERIFIED",
      deadlineExpired: false,
      eligibilityConfirmed: true,
      organizationName: "Ethiopian Airlines",
      locationName: "Addis Ababa",
    });
    mocks.mockFacebookPublication.mockResolvedValue(null);

    const html = await renderDetail(jobWith({ status: "PUBLISHED" }));

    expect(html).toContain("Publish to Facebook");
    expect(html).toContain("Job Ethiopia");
    expect(html).toContain("872697352845055");
    expect(html).toContain("Senior Pilot — Ethiopian Airlines");
    expect(html).toContain(
      "documented right to redistribute this listing",
    );
  });

  it("does not render the Facebook publish panel without a preview", async () => {
    const html = await renderDetail(jobWith({ status: "PUBLISHED" }));
    expect(html).not.toContain("Publish to Facebook");
  });
});

describe("AdminJobsPage — Source column", () => {
  function listResult(item: Record<string, unknown>) {
    return {
      items: [item],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    };
  }

  async function renderList(item: Record<string, unknown>) {
    mocks.mockListJobs.mockResolvedValue(listResult(item));
    const element = await AdminJobsPage({
      searchParams: Promise.resolve({}),
    });
    return renderToStaticMarkup(element);
  }

  it("renders the Source column header", async () => {
    const html = await renderList(SUMMARY);
    expect(html).toContain("Source");
  });

  it("renders the source name and type when provenance exists", async () => {
    const html = await renderList({
      ...SUMMARY,
      sourceName: "EthioJobs",
      sourceType: "WEBSITE",
    });
    expect(html).toContain("EthioJobs");
    expect(html).toContain("WEBSITE");
  });

  it("renders N/A for a job without provenance", async () => {
    const html = await renderList({
      ...SUMMARY,
      sourceName: null,
      sourceType: null,
    });
    expect(html).toContain("N/A");
  });
});

describe("AdminJobDetailPage — provenance section", () => {
  const PROVENANCE = {
    sourceId: "99999999-9999-4999-8999-999999999999",
    sourceName: "EthioJobs",
    sourceType: "WEBSITE",
    sourceUrl: "https://example.com/job/1",
    externalId: "ext-1",
    firstSeenAt: "2026-02-01T00:00:00.000Z",
    lastSeenAt: "2026-03-01T00:00:00.000Z",
    trustLevel: "MEDIUM",
  };

  async function renderDetail(job: unknown) {
    mocks.mockGetJob.mockResolvedValue(job);
    mocks.mockGetAudit.mockResolvedValue([]);
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    return renderToStaticMarkup(element);
  }

  it("renders source name, type, external id and trust level", async () => {
    const html = await renderDetail({ ...FULL_JOB, provenance: PROVENANCE });
    expect(html).toContain("EthioJobs");
    expect(html).toContain("WEBSITE");
    expect(html).toContain("ext-1");
    expect(html).toContain("MEDIUM");
  });

  it("renders the source URL as a safe external link", async () => {
    const html = await renderDetail({ ...FULL_JOB, provenance: PROVENANCE });
    expect(html).toContain('href="https://example.com/job/1"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not render a dangerous source URL as a link", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      provenance: { ...PROVENANCE, sourceUrl: "javascript:alert(1)" },
    });
    expect(html).toContain("javascript:alert(1)");
    expect(html).not.toContain('href="javascript:');
  });

  it("renders the first/last seen timestamps", async () => {
    const html = await renderDetail({ ...FULL_JOB, provenance: PROVENANCE });
    expect(html).toContain(new Date(PROVENANCE.firstSeenAt).toLocaleString());
    expect(html).toContain(new Date(PROVENANCE.lastSeenAt).toLocaleString());
  });

  it("shows a clear No source recorded state when provenance is null", async () => {
    const html = await renderDetail({ ...FULL_JOB, provenance: null });
    expect(html).toContain("No source recorded.");
  });

  it("shows a clear No source recorded state when provenance is missing on the record", async () => {
    const html = await renderDetail(FULL_JOB);
    expect(html).toContain("No source recorded.");
  });
});

describe("AdminJobDetailPage — category assignment", () => {
  const WASH_ID = "852af5d8-b7a9-4825-a251-00cc2087f0e5";
  const WASH_NAME = "Water, Sanitation and Hygiene (WASH)";

  async function renderDetail(job: unknown) {
    mocks.mockGetJob.mockResolvedValue(job);
    mocks.mockGetAudit.mockResolvedValue([]);
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    return renderToStaticMarkup(element);
  }

  it("offers the active WASH category in the dropdown for an uncategorized draft", async () => {
    mocks.mockListActiveCategories.mockResolvedValue([
      { id: WASH_ID, name: WASH_NAME },
    ]);

    const html = await renderDetail({
      ...FULL_JOB,
      status: "DRAFT",
      categoryId: null,
      categoryName: null,
    });

    expect(html).toContain("No category assigned.");
    expect(html).toContain("Assign category");
    expect(html).toContain(WASH_NAME);
    expect(html).toContain(`value="${WASH_ID}"`);
    expect(mocks.mockListActiveCategories).toHaveBeenCalled();
  });

  it("shows the assigned category and no assignment form", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "DRAFT",
      categoryId: WASH_ID,
      categoryName: WASH_NAME,
    });

    expect(html).toContain("Current category:");
    expect(html).toContain(WASH_NAME);
    expect(html).not.toContain("Assign category");
    expect(mocks.mockListActiveCategories).not.toHaveBeenCalled();
  });

  it("does not offer assignment for a non-draft job", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "PENDING_REVIEW",
      categoryId: null,
      categoryName: null,
    });

    expect(html).not.toContain("Assign category");
    expect(html).toContain(
      "A category can only be assigned while the job is a draft.",
    );
    expect(mocks.mockListActiveCategories).not.toHaveBeenCalled();
  });

  it("explains when no active categories are available", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "DRAFT",
      categoryId: null,
      categoryName: null,
    });

    expect(html).toContain("No active categories are available to assign.");
  });
});

describe("AdminJobDetailPage — Ethiopia Time deadline and draft correction", () => {
  const DEADLINE = new Date("2099-11-19T20:55:00.000Z");

  async function renderDetail(job: unknown) {
    mocks.mockGetJob.mockResolvedValue(job);
    mocks.mockGetAudit.mockResolvedValue([]);
    const element = await AdminJobDetailPage({
      params: Promise.resolve({ id: FULL_JOB.id }),
    });
    return renderToStaticMarkup(element);
  }

  it("displays the stored instant in Ethiopia Time, not the server timezone", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "PENDING_REVIEW",
      deadline: DEADLINE,
    });

    expect(html).toContain("Deadline (EAT)");
    expect(html).toContain("19 Nov 2099, 23:55 EAT");
  });

  it("offers the correction form for a draft with EAT-prefilled values", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "DRAFT",
      deadline: DEADLINE,
      description: "Official description",
      requirements: "Official requirements",
    });

    expect(html).toContain("Correct draft details");
    expect(html).toContain('name="deadline"');
    expect(html).toContain('value="2099-11-19T23:55"');
    expect(html).toContain("Official description");
    expect(html).toContain("Official requirements");
    expect(html).toContain("does not publish the job");
  });

  it("does not offer the correction form for a non-draft job", async () => {
    const html = await renderDetail({
      ...FULL_JOB,
      status: "PENDING_REVIEW",
      deadline: DEADLINE,
    });

    expect(html).not.toContain("Correct draft details");
  });
});
