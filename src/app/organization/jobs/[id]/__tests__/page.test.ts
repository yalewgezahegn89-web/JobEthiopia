import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockVerifySession: vi.fn(),
  mockGetJob: vi.fn(),
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
  getEmployerJob: (...a: unknown[]) => mocks.mockGetJob(...a),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: (): never => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import EmployerJobDetailPage from "../page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: USER_ID, role: "ORGANIZATION_ADMIN" };
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function detail(status = "DRAFT") {
  return {
    id: JOB_ID,
    title: "Senior Accountant",
    slug: "senior-accountant",
    organizationId: "org-1",
    organizationName: "Acme",
    description: "Manage financial records.",
    responsibilities: "Prep reports",
    requirements: "CPA",
    educationRequirements: null,
    benefits: null,
    categoryId: null,
    categoryName: null,
    professionId: null,
    professionName: null,
    locationId: null,
    locationName: "Addis Ababa",
    experienceMin: 3,
    experienceMax: 5,
    employmentType: "FULL_TIME",
    salaryMin: "100000",
    salaryMax: "150000",
    salaryCurrency: "ETB",
    salaryPeriod: "YEARLY",
    deadline: new Date("2026-06-01T00:00:00.000Z"),
    applicationUrl: null,
    postedAt: null,
    status,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function params() {
  return Promise.resolve({ id: JOB_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockVerifySession.mockResolvedValue(ADMIN);
  mocks.mockGetJob.mockResolvedValue(detail());
});

describe("EmployerJobDetailPage", () => {
  it("redirects to /login when unauthenticated", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    await expect(
      EmployerJobDetailPage({ params: params() }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("throws notFound when the job is not accessible", async () => {
    mocks.mockGetJob.mockResolvedValue(null);
    await expect(
      EmployerJobDetailPage({ params: params() }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("renders structured job metadata and sections", async () => {
    const element = await EmployerJobDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).toContain("Senior Accountant");
    expect(html).toContain("Acme");
    expect(html).toContain("Addis Ababa");
    expect(html).toContain("Full Time");
    expect(html).toContain("Manage financial records.");
    expect(html).toContain("Prep reports");
    expect(html).toContain("CPA");
  });

  it("renders status controls with submit-for-review for editable jobs", async () => {
    const element = await EmployerJobDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).toContain("Submit for Review");
    expect(html).toContain("Edit Job");
  });

  it("shows an editorial notice for published jobs and hides edit", async () => {
    mocks.mockGetJob.mockResolvedValue(detail("PUBLISHED"));
    const element = await EmployerJobDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).toContain("Published jobs cannot be edited by employers");
  });
});
