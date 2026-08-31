import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockRequireStaffAdmin: vi.fn(),
  mockGetRequest: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockRequireStaffAdmin(),
}));

vi.mock("@/lib/admin/employerRequests", () => ({
  getEmployerOnboardingRequest: (...args: unknown[]) => mocks.mockGetRequest(...args),
  approveEmployerOnboarding: vi.fn(),
  rejectEmployerOnboarding: vi.fn(),
  isValidUuid: () => true,
  listEmployerOnboardingRequests: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOTFOUND");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import AdminEmployerRequestDetailPage from "../page";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function staff(role = "ADMIN") {
  return { ok: true, user: { id: "33333333-3333-4333-8333-333333333333", role } };
}

function requestRow(status = "PENDING") {
  return {
    id: REQUEST_ID,
    userId: "22222222-2222-4222-8222-222222222222",
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    industry: "Coffee",
    description: "A roastery",
    websiteUrl: "https://almaz.example.com",
    contactPhone: "+251911000000",
    locationId: null,
    status,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submitterEmail: "almaz@example.com",
    submitterName: "Almaz Tesfaye",
  };
}

async function renderPage() {
  const element = await AdminEmployerRequestDetailPage({
    params: Promise.resolve({ id: REQUEST_ID }),
  });
  return renderToStaticMarkup(element as unknown as ReactNode);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockRequireStaffAdmin.mockResolvedValue(staff());
  mocks.mockGetRequest.mockResolvedValue(requestRow("PENDING"));
});

describe("AdminEmployerRequestDetailPage", () => {
  it("is staff-gated and redirects unauthenticated users to login", async () => {
    mocks.mockRequireStaffAdmin.mockResolvedValue({ ok: false, status: 401 });
    await expect(renderPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("renders the request details", async () => {
    const html = await renderPage();
    expect(html).toContain("Almaz Coffee PLC");
    expect(html).toContain("almaz-coffee");
    expect(html).toContain("Almaz Tesfaye");
  });

  it("shows the review panel to an approving staff member on a pending request", async () => {
    const html = await renderPage();
    expect(html).toContain("Review request");
    expect(html).toContain("Approve request");
    expect(html).toContain("Reject request");
  });

  it("a MODERATOR sees reject but not approve", async () => {
    mocks.mockRequireStaffAdmin.mockResolvedValue(staff("MODERATOR"));
    const html = await renderPage();
    expect(html).toContain("Reject request");
    expect(html).not.toContain("Approve request");
  });

  it("shows no review panel once the request is no longer pending", async () => {
    mocks.mockGetRequest.mockResolvedValue(requestRow("APPROVED"));
    const html = await renderPage();
    expect(html).toContain("APPROVED");
    expect(html).not.toContain("Approve request");
  });

  it("calls notFound when the request does not exist", async () => {
    mocks.mockGetRequest.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NOTFOUND");
  });
});
