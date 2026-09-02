import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockVerifySession: vi.fn(),
  mockListJobs: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => ({ value: "raw-token" }),
  }),
}));

vi.mock("@/lib/auth/constants", () => ({
  SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/employer/jobs", () => ({
  listEmployerJobs: (...a: unknown[]) => mocks.mockListJobs(...a),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import EmployerJobsPage from "../page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: USER_ID, role: "ORGANIZATION_ADMIN" };

function jobResult() {
  return {
    items: [
      {
        id: "job-1",
        title: "Senior Accountant",
        organizationId: "org-1",
        organizationName: "Acme",
        status: "PUBLISHED",
        deadline: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        applicationCount: 5,
        needsReviewCount: 2,
      },
      {
        id: "job-2",
        title: "Draft Role",
        organizationId: "org-1",
        organizationName: "Acme",
        status: "DRAFT",
        deadline: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        applicationCount: 0,
        needsReviewCount: 0,
      },
    ],
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  };
}

function searchParams(overrides: Record<string, string> = {}) {
  return Promise.resolve({ ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockVerifySession.mockResolvedValue(ADMIN);
  mocks.mockListJobs.mockResolvedValue(jobResult());
});

describe("EmployerJobsPage", () => {
  it("redirects to /login when unauthenticated", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    await expect(
      EmployerJobsPage({ searchParams: searchParams() }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("lists jobs with status badges and application counts", async () => {
    const element = await EmployerJobsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("Senior Accountant");
    expect(html).toContain("Draft Role");
    expect(html).toContain("Published");
    expect(html).toContain("Draft");
    expect(html).toContain("2 to review");
    expect(html).toContain("Acme");
  });

  it("passes the status filter to the list call", async () => {
    await EmployerJobsPage({
      searchParams: searchParams({ status: "PUBLISHED" }),
    });
    expect(mocks.mockListJobs).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ status: "PUBLISHED" }),
    );
  });

  it("shows an empty state when there are no jobs", async () => {
    mocks.mockListJobs.mockResolvedValue({
      ...jobResult(),
      items: [],
      total: 0,
      totalPages: 1,
    });
    const element = await EmployerJobsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("No jobs found");
  });

  it("shows an error state when the list fails", async () => {
    mocks.mockListJobs.mockRejectedValue(new Error("db down"));
    const element = await EmployerJobsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("Unable to load jobs");
  });
});
