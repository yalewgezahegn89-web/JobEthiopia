import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockListJobs: vi.fn(),
  mockGetJob: vi.fn(),
  mockGetAudit: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
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
