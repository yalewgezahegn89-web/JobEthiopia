import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockGetOperationsSummary: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/admin/operations", () => ({
  getOperationsSummary: (...args: unknown[]) =>
    mocks.mockGetOperationsSummary(...args),
}));

import AdminOperationsPage from "@/app/admin/operations/page";

const EMPTY_SUMMARY = {
  latestMaintenance: null,
  recentMaintenance: [],
  latestIngestion: null,
  recentIngestion: [],
  failingSources: [],
};

const POPULATED_SUMMARY = {
  latestMaintenance: {
    timestamp: "2026-03-15T10:00:00.000Z",
    expiredJobs: 5,
    sourcesChecked: 10,
    sourcesSucceeded: 8,
    sourcesFailed: 1,
    sourcesSkipped: 1,
    durationMs: 1234,
  },
  recentMaintenance: [],
  latestIngestion: {
    timestamp: "2026-03-15T09:00:00.000Z",
    sourceId: "src-111",
    sourceName: "Test Source",
    total: 20,
    created: 10,
    updated: 3,
    duplicate: 5,
    linked: 1,
    possibleDuplicate: 1,
    failed: 0,
    durationMs: 567,
  },
  recentIngestion: [],
  failingSources: [
    {
      id: "src-222",
      name: "Failing Source",
      lastError: "HTTP 500",
      consecutiveFailures: 3,
      lastAttemptedCheck: "2026-03-15T08:00:00.000Z",
      lastSuccessfulCheck: "2026-03-14T08:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
  mocks.mockGetOperationsSummary.mockResolvedValue(EMPTY_SUMMARY);
});

describe("AdminOperationsPage", () => {
  it("renders the page for staff", async () => {
    const element = await AdminOperationsPage();
    expect(element.type).toBe("div");
    expect(mocks.mockGetOperationsSummary).toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminOperationsPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminOperationsPage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders safe error on DB failure", async () => {
    mocks.mockGetOperationsSummary.mockRejectedValue(new Error("db down"));
    const element = await AdminOperationsPage();
    expect(element).toBeTruthy();
  });

  it("renders maintenance section when data exists", async () => {
    mocks.mockGetOperationsSummary.mockResolvedValue(POPULATED_SUMMARY);
    const element = await AdminOperationsPage();
    const summary = element.props.children[1].props.children[1].props.summary;
    expect(summary.latestMaintenance).not.toBeNull();
    expect(summary.latestMaintenance.expiredJobs).toBe(5);
  });

  it("renders ingestion section when data exists", async () => {
    mocks.mockGetOperationsSummary.mockResolvedValue(POPULATED_SUMMARY);
    const element = await AdminOperationsPage();
    const summary = element.props.children[1].props.children[1].props.summary;
    expect(summary.latestIngestion).not.toBeNull();
    expect(summary.latestIngestion.sourceName).toBe("Test Source");
  });

  it("renders failing sources section when data exists", async () => {
    mocks.mockGetOperationsSummary.mockResolvedValue(POPULATED_SUMMARY);
    const element = await AdminOperationsPage();
    const summary = element.props.children[1].props.children[1].props.summary;
    expect(summary.failingSources).toHaveLength(1);
    expect(summary.failingSources[0].lastError).toBe("HTTP 500");
  });

  it("renders empty states when no data", async () => {
    const element = await AdminOperationsPage();
    const summary = element.props.children[1].props.children[1].props.summary;
    expect(summary.latestMaintenance).toBeNull();
    expect(summary.latestIngestion).toBeNull();
    expect(summary.failingSources).toHaveLength(0);
  });
});
