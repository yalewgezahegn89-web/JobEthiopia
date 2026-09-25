import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/admin/observability",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/ui/brand-mark", () => ({
  BrandMark: () => createElement("svg", { "data-testid": "brand" }),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

import AdminObservabilityPage from "@/app/admin/observability/page";
import {
  OBSERVABILITY_SCOPE_NOTE,
  PLANNING_THRESHOLDS,
} from "@/lib/admin/observability";
import {
  recordApiRequest,
  recordCacheEvent,
  recordIngestionRun,
  recordInternalFetch,
  recordRateLimitRejection,
  resetOperationalMetrics,
} from "@/lib/observability/metrics";
import {
  recordDbProbe,
  registerPoolStatsProvider,
  resetDatabaseMetrics,
} from "@/lib/observability/dbMetrics";

async function renderPage(): Promise<string> {
  const element = await AdminObservabilityPage();
  return renderToStaticMarkup(element);
}

function seedPopulatedState(): void {
  for (let i = 0; i < 20; i += 1) {
    recordApiRequest({
      route: "/api/jobs",
      method: "GET",
      status: i === 7 ? 500 : 200,
      durationMs: i === 19 ? 1_450 : 120,
    });
  }
  recordRateLimitRejection({ bucket: "login", route: "/login", at: 0 });
  recordCacheEvent({
    name: "analytics_summary",
    outcome: "miss",
    buildDurationMs: 210,
  });
  recordCacheEvent({ name: "analytics_summary", outcome: "hit" });
  recordCacheEvent({ name: "analytics_summary", outcome: "evict" });
  recordInternalFetch({
    target: "/api/jobs?q=secret-search-term",
    durationMs: 610,
    ok: true,
    requestId: "req-1",
  });
  recordIngestionRun({
    at: 1_700_000_000_000,
    status: "PARTIAL",
    durationMs: 3_210,
    sourcesAttempted: 4,
    sourcesSucceeded: 3,
    sourcesFailed: 1,
    sourcesSkipped: 0,
    jobsReceived: 240,
    jobsCreated: 31,
    jobsUpdated: 12,
    duplicates: 90,
    failedRecords: 2,
    autoDeactivatedSources: 1,
  });
  registerPoolStatsProvider(() => ({
    max: 10,
    total: 8,
    idle: 4,
    waiting: 1,
    connectTimeoutMs: 10_000,
    idleTimeoutMs: 30_000,
  }));
  recordDbProbe({ ok: true, durationMs: 42, at: 1_700_000_000_000 });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetOperationalMetrics();
  resetDatabaseMetrics();
  registerPoolStatsProvider(() => null);
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "u1", email: "a@b.com", name: "A", role: "MODERATOR" },
  });
});

describe("AdminObservabilityPage", () => {
  it("renders for staff", async () => {
    const html = await renderPage();

    expect(html).toContain("Observability");
    expect(html).toContain(OBSERVABILITY_SCOPE_NOTE);
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(AdminObservabilityPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-staff to /admin", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(AdminObservabilityPage()).rejects.toThrow("REDIRECT:/admin");
  });

  it("renders every required operational section", async () => {
    const html = await renderPage();

    for (const title of [
      "Request health",
      "Database",
      "Ingestion",
      "Rate limiting",
      "Cache",
      "Internal HTTP",
      "Planning thresholds",
    ]) {
      expect(html).toContain(title);
    }
  });

  it("shows empty states before anything is measured", async () => {
    const html = await renderPage();

    expect(html).toContain("no traffic yet");
    expect(html).toContain("no runs recorded");
    expect(html).toContain("no cache activity recorded");
    expect(html).toContain("pool unavailable");
  });

  it("publishes §11 thresholds as guidance, never as measurements", async () => {
    const html = await renderPage();

    expect(html).toContain(`${PLANNING_THRESHOLDS.latencyWarnMs} ms`);
    expect(html).toContain("instrumentation readings");
    expect(html).toContain("not measurements");
    expect(html).toContain(`${PLANNING_THRESHOLDS.dbConnectionsWarnPercent} %`);
  });

  it("renders live values from the in-process registries", async () => {
    seedPopulatedState();
    const html = await renderPage();

    expect(html).toContain("20");
    expect(html).toContain("2xx 19");
    expect(html).toContain("1450");
    expect(html).toContain("Bucket: login");
    expect(html).toContain("Cache: analytics_summary");
    expect(html).toContain("hits 1");
    expect(html).toContain("/api/jobs");
    expect(html).toContain("PARTIAL");
    expect(html).toContain("4 / 10");
    expect(html).toContain("ok in 42 ms");
  });

  it("never renders credentials, identity data, SQL, hosts or search terms", async () => {
    seedPopulatedState();
    const html = await renderPage();

    expect(html).not.toContain("DATABASE_URL");
    expect(html).not.toContain("password");
    expect(html).not.toContain("a@b.com");
    expect(html).not.toContain("127.0.0.1");
    expect(html).not.toContain("localhost");
    expect(html).not.toContain("secret-search-term");
    expect(html).not.toContain("SELECT");
    expect(html).not.toContain("postgres");
  });
});
