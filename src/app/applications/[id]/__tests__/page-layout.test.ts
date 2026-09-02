import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDetail: vi.fn(),
  mockHistory: vi.fn(),
  mockResume: vi.fn(),
  mockResumeForm: vi.fn(),
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
  getCandidateApplicationHistory: (...args: unknown[]) =>
    mocks.mockHistory(...args),
}));

vi.mock("@/components/applications/withdraw-button", () => ({
  ApplicationWithdraw: ({ applicationId }: { applicationId: string }) =>
    createElement("div", { "data-testid": "withdraw" }, applicationId),
}));

vi.mock("@/lib/resume/dal", () => ({
  getOwnedCandidateResume: (...args: unknown[]) => mocks.mockResume(...args),
}));

vi.mock("@/components/applications/resume-form", () => ({
  ResumeForm: (props: Record<string, unknown>) => {
    mocks.mockResumeForm(props);
    return createElement(
      "div",
      { "data-testid": "resume-form" },
      JSON.stringify(props),
    );
  },
}));

import ApplicationDetailPage from "@/app/applications/[id]/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const APP_ID = "33333333-3333-4333-8333-333333333333";

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: APP_ID,
    jobId: "22222222-2222-4222-8222-222222222222",
    jobTitle: "Software Engineer",
    organizationName: "EthioTech",
    status: "SUBMITTED",
    coverLetter: "I am a great fit.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
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

describe("ApplicationDetailPage layout", () => {
  it("renders a breadcrumb to My Applications and a single H1 of the job", async () => {
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain('href="/applications"');
    expect(html).toContain("<h1");
    const h1Count = (html.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(html).toContain("Software Engineer");
  });

  it("renders the organization from the application data", async () => {
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain("EthioTech");
  });

  it("shows the status badge and a progress panel for active statuses", async () => {
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain("Submitted");
    expect(html).toContain("Application progress");
  });

  it("hides the progress list and shows a terminal state for REJECTED", async () => {
    mocks.mockDetail.mockResolvedValue(detail({ status: "REJECTED", coverLetter: null }));
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain("Rejected");
    expect(html).not.toContain("Application progress");
    expect(html).toContain('role="status"');
  });

  it("renders the application history as a timeline", async () => {
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain("Application history");
    expect(html).toContain("Application submitted");
  });

  it("renders the cover letter when present and hides it when absent", async () => {
    const withCover = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(withCover).toContain("Cover letter");
    expect(withCover).toContain("I am a great fit.");

    mocks.mockDetail.mockResolvedValue(detail({ coverLetter: null }));
    const withoutCover = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(withoutCover).not.toContain("Cover letter");
  });

  it("renders the resume section and passes safe resume props", async () => {
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
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain("Resume");
    const lastProps = mocks.mockResumeForm.mock.calls.at(-1)?.[0] as {
      current: { originalName: string; size: number; updatedAt: string };
    };
    expect(lastProps.current).toMatchObject({
      originalName: "cv.pdf",
      size: 1234,
    });
    expect(lastProps.current.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("exposes no storage keys or password values", async () => {
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
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).not.toContain("resumes/key.pdf");
    expect(html).not.toContain("objectKey");
    expect(html).not.toContain("OldPassword");
    expect(html).not.toContain("passwordHash");
  });

  it("shows a view-job link and withdraw for SUBMITTED", async () => {
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).toContain('href="/jobs/22222222-2222-4222-8222-222222222222"');
    expect(html).toContain("View job");
    expect(html).toContain('data-testid="withdraw"');
  });

  it("hides withdraw for non-withdrawable terminal statuses", async () => {
    mocks.mockDetail.mockResolvedValue(detail({ status: "REJECTED", coverLetter: null }));
    const html = renderToStaticMarkup(await ApplicationDetailPage({ params: params() }));
    expect(html).not.toContain("data-testid=\"withdraw\"");
  });
});