import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

vi.mock("@/lib/applications/dal", () => ({
  listApplicationsForCandidate: (...args: unknown[]) => mocks.mockList(...args),
}));

import ApplicationsPage from "@/app/applications/page";

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
        status: "SUBMITTED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    page: 1,
    limit: 100,
    total: 1,
    totalPages: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockList.mockResolvedValue(listResult());
});

describe("ApplicationsPage", () => {
  it("renders the candidate's application list", async () => {
    const element = await ApplicationsPage();
    expect(element).toBeTruthy();
    expect(mocks.mockList).toHaveBeenCalledWith(
      CANDIDATE.id,
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("renders a single H1 with the page title", async () => {
    const html = renderToStaticMarkup(await ApplicationsPage());
    const h1Count = (html.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(html).toContain("My Applications");
  });

  it("lists application details with status, dates and a view link", async () => {
    const html = renderToStaticMarkup(await ApplicationsPage());
    expect(html).toContain("Accountant");
    expect(html).toContain("ACME Plc");
    expect(html).toContain("Submitted");
    expect(html).toContain("Applied Jan 1, 2026");
    expect(html).toContain(
      'href="/applications/33333333-3333-4333-8333-333333333333"',
    );
    expect(html).toContain("View application");
    expect(html).toContain("1 tracked application");
  });

  it("shows a summary chip with pluralized count", async () => {
    const html = renderToStaticMarkup(await ApplicationsPage());
    expect(html).toContain("1 tracked application");
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(ApplicationsPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(ApplicationsPage()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("renders an empty state when the candidate has no applications", async () => {
    mocks.mockList.mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    });
    const element = await ApplicationsPage();
    expect(element).toBeTruthy();
  });

  it("renders a safe error on load failure", async () => {
    mocks.mockList.mockRejectedValue(new Error("db down"));
    const element = await ApplicationsPage();
    expect(element).toBeTruthy();
  });
});
