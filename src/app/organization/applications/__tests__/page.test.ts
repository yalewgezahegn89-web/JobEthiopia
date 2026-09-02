import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockListApps: vi.fn(),
  mockListJobs: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...a: unknown[]) => mocks.mockGetCurrentUser(...a),
}));

vi.mock("@/lib/employer/applications", () => ({
  listEmployerApplications: (...a: unknown[]) => mocks.mockListApps(...a),
  listEmployerJobsForFilter: (...a: unknown[]) => mocks.mockListJobs(...a),
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

vi.mock("@/components/employer/bulk-application-actions", () => ({
  BulkApplicationActions: ({
    applications,
  }: {
    applications: { id: string; jobTitle: string }[];
  }) =>
    createElement(
      "div",
      { "data-testid": "bulk-actions" },
      `bulk:${applications.map((a) => a.id).join(",")}`,
    ),
}));

import EmployerApplicationsPage from "../page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: USER_ID, role: "ORGANIZATION_ADMIN" };

function app(id: string, status: string) {
  return {
    id,
    jobId: "job-1",
    jobTitle: "Senior Accountant",
    organizationId: "org-1",
    organizationName: "Acme",
    candidateId: "cand-1",
    candidateName: "Abebe",
    candidateEmail: "abebe@example.com",
    status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function result(ids: string[], statuses: string[]) {
  return {
    items: ids.map((id, i) => app(id, statuses[i] ?? "SUBMITTED")),
    page: 1,
    limit: 20,
    total: ids.length,
    totalPages: 1,
  };
}

function searchParams(overrides: Record<string, string> = {}) {
  return Promise.resolve({ ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(ADMIN);
  mocks.mockListApps.mockImplementation((_uid: string, opts: { status?: string }) =>
    Promise.resolve(result(["app-1"], [opts.status ?? "SUBMITTED"])),
  );
  mocks.mockListJobs.mockResolvedValue([{ id: "job-1", title: "Senior Accountant" }]);
});

describe("EmployerApplicationsPage", () => {
  it("redirects to /login when unauthenticated", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      EmployerApplicationsPage({ searchParams: searchParams() }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("renders applications and passes them to bulk actions", async () => {
    const element = await EmployerApplicationsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("Applications");
    expect(html).toContain("1 application total");
    expect(html).toContain("bulk:app-1");
  });

  it("passes the status filter through", async () => {
    await EmployerApplicationsPage({
      searchParams: searchParams({ status: "SUBMITTED" }),
    });
    expect(mocks.mockListApps).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ status: "SUBMITTED" }),
    );
  });

  it("shows an empty state when there are no applications", async () => {
    mocks.mockListApps.mockResolvedValue(result([], []));
    const element = await EmployerApplicationsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("No applications found");
  });

  it("shows an error state when loading fails", async () => {
    mocks.mockListApps.mockRejectedValue(new Error("db down"));
    const element = await EmployerApplicationsPage({
      searchParams: searchParams(),
    });
    const html = renderToString(element);
    expect(html).toContain("Could not load applications");
  });

  it("shows a Clear filters link when filters are active", async () => {
    const element = await EmployerApplicationsPage({
      searchParams: searchParams({ status: "REVIEWING", sort: "oldest" }),
    });
    const html = renderToString(element);
    expect(html).toContain("Clear filters");
  });
});
