import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockList: vi.fn(),
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

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/savedJobs/dal", () => ({
  listSavedJobs: (...args: unknown[]) => mocks.mockList(...args),
}));

vi.mock("@/components/saved-jobs/saved-job-list", () => ({
  SavedJobList: ({ items }: { items: unknown[] }) => createElement("ul", { "data-testid": "saved-list" }, String(items.length)),
}));

import SavedJobsPage from "@/app/saved-jobs/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

function listResult() {
  return {
    items: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        jobId: "22222222-2222-4222-8222-222222222222",
        jobTitle: "Accountant",
        organizationName: "ACME Plc",
        locationName: "Addis Ababa",
        deadline: "2026-02-01T00:00:00.000Z",
        deadlineText: "Feb 1, 2026",
        status: "PUBLISHED",
        savedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockList.mockResolvedValue(listResult());
});

describe("SavedJobsPage", () => {
  it("renders the candidate's saved jobs list", async () => {
    const element = await SavedJobsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
    expect(mocks.mockList).toHaveBeenCalledWith(
      CANDIDATE.id,
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(SavedJobsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(SavedJobsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/jobs");
  });

  it("renders an empty state when the candidate has no saved jobs", async () => {
    mocks.mockList.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });
    const element = await SavedJobsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("parses the page search param as a positive integer", async () => {
    await SavedJobsPage({ searchParams: Promise.resolve({ page: "3" }) });
    expect(mocks.mockList).toHaveBeenCalledWith(CANDIDATE.id, expect.objectContaining({ page: 3 }));
  });

  it("falls back to page 1 for an invalid page param", async () => {
    await SavedJobsPage({ searchParams: Promise.resolve({ page: "abc" }) });
    expect(mocks.mockList).toHaveBeenCalledWith(CANDIDATE.id, expect.objectContaining({ page: 1 }));
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockList.mockRejectedValue(new Error("db down"));
    const element = await SavedJobsPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });
});
