import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetEmployerApplication: vi.fn(),
  mockHistory: vi.fn(),
  mockResume: vi.fn(),
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
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/employer/applications", () => ({
  getEmployerApplication: (...args: unknown[]) =>
    mocks.mockGetEmployerApplication(...args),
  getEmployerApplicationStatusHistory: (...args: unknown[]) =>
    mocks.mockHistory(...args),
}));

vi.mock("@/lib/resume/dal", () => ({
  getEmployerApplicationResume: (...args: unknown[]) =>
    mocks.mockResume(...args),
}));

vi.mock("./status-form", () => ({
  StatusForm: () => null,
}));

import EmployerApplicationDetailPage from "../page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const APP_ID = "44444444-4444-4444-8444-444444444444";

function employerDetail() {
  return {
    id: APP_ID,
    jobId: JOB_ID,
    jobTitle: "Software Engineer",
    organizationName: "EthioTech",
    organizationId: ORG_ID,
    candidateId: "cand-1",
    candidateName: "Abebe",
    candidateEmail: "abebe@example.com",
    candidatePhone: null,
    candidateLocationName: null,
    candidateProfessionalSummary: null,
    candidateTotalExperienceYears: null,
    candidateEducation: null,
    coverLetter: null,
    status: "SUBMITTED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function params() {
  return Promise.resolve({ id: APP_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue({
    id: USER_ID,
    role: "ORGANIZATION_ADMIN",
  });
  mocks.mockGetEmployerApplication.mockResolvedValue(employerDetail());
  mocks.mockHistory.mockResolvedValue([]);
  mocks.mockResume.mockResolvedValue(null);
});

describe("EmployerApplicationDetailPage", () => {
  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(
      EmployerApplicationDetailPage({ params: params() }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-org-admin roles to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    await expect(
      EmployerApplicationDetailPage({ params: params() }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("throws notFound when the application is not accessible", async () => {
    mocks.mockGetEmployerApplication.mockResolvedValue(null);
    await expect(
      EmployerApplicationDetailPage({ params: params() }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("calls the employer resume lookup for the application", async () => {
    await EmployerApplicationDetailPage({ params: params() });
    expect(mocks.mockResume).toHaveBeenCalledWith(APP_ID, USER_ID);
  });

  it("renders candidate details", async () => {
    const element = await EmployerApplicationDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).toContain("Abebe");
    expect(html).toContain("Software Engineer");
  });

  it("renders a resume download link when a resume exists", async () => {
    mocks.mockResume.mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      applicationId: APP_ID,
      objectKey: "resumes/key.pdf",
      originalName: "abebe-cv.pdf",
      mimeType: "application/pdf",
      size: 2048,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const element = await EmployerApplicationDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).toContain("abebe-cv.pdf");
    expect(html).toContain(`/api/applications/${APP_ID}/resume`);
  });

  it("omits the resume block when no resume exists", async () => {
    const element = await EmployerApplicationDetailPage({ params: params() });
    const html = renderToString(element);
    expect(html).not.toContain("/api/applications");
  });
});
