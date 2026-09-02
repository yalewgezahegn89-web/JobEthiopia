import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockRequireStaffAdmin: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockRequireStaffAdmin(),
}));

vi.mock("@/lib/admin/employerRequests", () => ({
  listEmployerOnboardingRequests: (...args: unknown[]) => mocks.mockList(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/admin/employer-requests",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import AdminEmployerRequestsPage from "../page";

function staff() {
  return { ok: true, user: { id: "33333333-3333-4333-8333-333333333333", role: "ADMIN" } };
}

async function renderPage(searchParams = {}): Promise<string> {
  const element = await AdminEmployerRequestsPage({
    searchParams: Promise.resolve(searchParams),
  });
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRequireStaffAdmin.mockResolvedValue(staff());
  mocks.mockList.mockResolvedValue({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
});

describe("AdminEmployerRequestsPage", () => {
  it("is staff-gated and redirects unauthenticated users to login", async () => {
    mocks.mockRequireStaffAdmin.mockResolvedValue({ ok: false, status: 401 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff users to the admin home", async () => {
    mocks.mockRequireStaffAdmin.mockResolvedValue({ ok: false, status: 403 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders the page title and status tabs", async () => {
    const html = await renderPage();
    expect(html).toContain("Employer Requests");
    expect(html).toContain("All");
    expect(html).toContain("Pending");
    expect(html).toContain("Approved");
    expect(html).toContain("Rejected");
    expect(html).toContain('href="/admin/employer-requests?status=PENDING"');
  });

  it("requests the list with the status filter", async () => {
    await renderPage({ status: "PENDING" });
    expect(mocks.mockList).toHaveBeenCalledWith({ page: 1, limit: 20, status: "PENDING" });
  });

  it("shows an empty state when there are no requests", async () => {
    const html = await renderPage();
    expect(html).toContain("No requests found");
  });

  it("lists request rows and links to their detail pages", async () => {
    mocks.mockList.mockResolvedValue({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          organizationName: "Almaz Coffee PLC",
          organizationSlug: "almaz-coffee",
          industry: "Coffee",
          status: "PENDING",
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const html = await renderPage();
    expect(html).toContain("Almaz Coffee PLC");
    expect(html).toContain("PENDING");
    expect(html).toContain('href="/admin/employer-requests/11111111-1111-4111-8111-111111111111"');
  });

  it("shows an error message when the list fails to load", async () => {
    mocks.mockList.mockRejectedValue(new Error("db down"));
    const html = await renderPage();
    expect(html).toContain("could not load employer requests");
  });

  it("shows pagination when there are multiple pages", async () => {
    mocks.mockList.mockResolvedValue({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          organizationName: "A",
          organizationSlug: "a",
          industry: null,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      limit: 20,
      total: 25,
      totalPages: 2,
    });
    const html = await renderPage();
    expect(html).toContain("Next");
  });
});
