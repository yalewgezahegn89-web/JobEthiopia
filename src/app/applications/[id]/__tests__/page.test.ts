import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDetail: vi.fn(),
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

vi.mock("@/lib/applications/dal", () => ({
  getOwnedApplicationDetail: (...args: unknown[]) => mocks.mockDetail(...args),
  getCandidateApplicationHistory: (...args: unknown[]) => mocks.mockHistory(...args),
}));

vi.mock("@/components/applications/withdraw-button", () => ({
  ApplicationWithdraw: () => null,
}));

vi.mock("@/lib/resume/dal", () => ({
  getOwnedCandidateResume: (...args: unknown[]) => mocks.mockResume(...args),
}));

vi.mock("@/components/applications/resume-form", () => ({
  ResumeForm: () => null,
}));

import ApplicationDetailPage from "@/app/applications/[id]/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const APP_ID = "33333333-3333-4333-8333-333333333333";

function detail() {
  return {
    id: APP_ID,
    jobId: "22222222-2222-4222-8222-222222222222",
    jobTitle: "Software Engineer",
    organizationName: "EthioTech",
    status: "SUBMITTED",
    coverLetter: "I am a great fit.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function params() {
  return Promise.resolve({ id: APP_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockDetail.mockResolvedValue(detail());
  mocks.mockHistory.mockResolvedValue([
    {
      action: "APPLICATION_SUBMITTED",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      previousStatus: null,
      newStatus: "SUBMITTED",
    },
  ]);
  mocks.mockResume.mockResolvedValue(null);
});

describe("ApplicationDetailPage", () => {
  it("renders the candidate's own application with job and organization", async () => {
    const element = await ApplicationDetailPage({ params: params() });
    expect(element).toBeTruthy();
    expect(mocks.mockDetail).toHaveBeenCalledWith(APP_ID, CANDIDATE.id);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(ApplicationDetailPage({ params: params() })).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(ApplicationDetailPage({ params: params() })).rejects.toThrow("REDIRECT:/jobs");
  });

  it("throws notFound for a malformed id", async () => {
    await expect(
      ApplicationDetailPage({ params: Promise.resolve({ id: "not-a-uuid" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.mockDetail).not.toHaveBeenCalled();
  });

  it("throws notFound when the application is not owned", async () => {
    mocks.mockDetail.mockResolvedValue(null);
    await expect(ApplicationDetailPage({ params: params() })).rejects.toThrow("NOT_FOUND");
  });

  it("loads the status history for the application", async () => {
    await ApplicationDetailPage({ params: params() });
    expect(mocks.mockHistory).toHaveBeenCalledWith(APP_ID);
  });

  it("does not render the cover letter when absent", async () => {
    mocks.mockDetail.mockResolvedValue({ ...detail(), coverLetter: null });
    const element = await ApplicationDetailPage({ params: params() });
    expect(element).toBeTruthy();
  });

  it("hides withdrawal for non-withdrawable status", async () => {
    mocks.mockDetail.mockResolvedValue({ ...detail(), status: "REJECTED" });
    const element = await ApplicationDetailPage({ params: params() });
    expect(element).toBeTruthy();
  });

  it("loads the candidate's own resume for the application", async () => {
    await ApplicationDetailPage({ params: params() });
    expect(mocks.mockResume).toHaveBeenCalledWith(APP_ID, CANDIDATE.id);
  });

  it("renders when a resume exists", async () => {
    mocks.mockResume.mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      applicationId: APP_ID,
      objectKey: "resumes/key.pdf",
      originalName: "cv.pdf",
      mimeType: "application/pdf",
      size: 1234,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const element = await ApplicationDetailPage({ params: params() });
    expect(element).toBeTruthy();
  });
});
