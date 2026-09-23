import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) =>
    createElement(
      "a",
      { href },
      children,
    ),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: (...args: unknown[]) => mocks.mockGetCurrentUser(...args),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      employerOnboardingRequests: {
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/lib/i18n/server", () => ({
  getI18n: () => import("@/lib/i18n/messages/en").then((m) => m.en),
}));

vi.mock("@/app/employer/status/resubmit-form", () => ({
  EmployerResubmitForm: () => createElement("form", { "data-testid": "resubmit-form" }),
}));

import EmployerStatusPage from "../page";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    userId: USER_ID,
    organizationName: "Almaz Coffee PLC",
    organizationSlug: "almaz-coffee",
    status: "PENDING",
    reviewNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmployerStatusPage", () => {
  it("redirects to /login when unauthenticated", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(EmployerStatusPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /organization when the latest request is APPROVED", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockResolvedValue(requestRow({ status: "APPROVED" }));
    await expect(EmployerStatusPage()).rejects.toThrow("REDIRECT:/organization");
  });

  it("renders the pending state with the organization name", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockResolvedValue(requestRow());

    const element = await EmployerStatusPage();
    const html = renderToString(element);
    expect(html).toContain("Pending review");
    expect(html).toContain("Almaz Coffee PLC");
    expect(html).not.toContain("resubmit-form");
  });

  it("renders rejection feedback and a resubmit form when reviewNotes exist", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockResolvedValue(
      requestRow({
        status: "REJECTED",
        reviewNotes: "The organization name appears to be misspelled.",
      }),
    );

    const element = await EmployerStatusPage();
    const html = renderToString(element);
    expect(html).toContain("The organization name appears to be misspelled.");
    expect(html).toContain("Review feedback");
    expect(html).toContain("resubmit-form");
  });

  it("renders the resubmit form without a reason box when there are no reviewNotes", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockResolvedValue(requestRow({ status: "REJECTED", reviewNotes: null }));

    const element = await EmployerStatusPage();
    const html = renderToString(element);
    expect(html).toContain("Submit a revised request");
    expect(html).toContain("resubmit-form");
    expect(html).not.toContain("Review feedback");
  });

  it("renders a request CTA when the user has no request", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockResolvedValue(null);

    const element = await EmployerStatusPage();
    const html = renderToString(element);
    expect(html).toContain("No employer request yet");
    expect(html).toContain("/employer/register");
  });

  it("renders a load error state when the query fails", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ id: USER_ID, role: "CANDIDATE" });
    mocks.mockFindFirst.mockRejectedValue(new Error("db down"));

    const element = await EmployerStatusPage();
    const html = renderToString(element);
    expect(html).toContain("Request status");
  });
});