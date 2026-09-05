import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── Mocks ──────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    query: {
      jobs: { findFirst: vi.fn(), findMany: vi.fn() },
      sources: { findFirst: vi.fn(), findMany: vi.fn() },
      organizations: { findFirst: vi.fn(), findMany: vi.fn() },
      categories: { findFirst: vi.fn(), findMany: vi.fn() },
      professions: { findFirst: vi.fn(), findMany: vi.fn() },
      locations: { findFirst: vi.fn(), findMany: vi.fn() },
      careerArticles: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  },
  mockCheckApiKey: vi.fn(),
  mockAssertTrustedCsrf: vi.fn(),
  mockCsrfError: class CsrfError extends Error {
    constructor() {
      super("CSRF");
      this.name = "CsrfError";
    }
  },
  mockWriteAuditLog: vi.fn(),
  mockSsrfFetch: vi.fn(),
  mockRunMaintenance: vi.fn(),
  mockRecordSuccessfulCheck: vi.fn(),
  mockRecordFailedCheck: vi.fn(),
  mockGetSourceHealth: vi.fn(),
  mockIsSourceDueForCheck: vi.fn(),
  mockCreateJobDirect: vi.fn(),
  mockIngestJobs: vi.fn(),
}));

vi.mock("@/db", () => ({ db: mocks.mockDb }));

vi.mock("@/lib/auth/apiKey", () => ({
  checkApiKey: (...args: unknown[]) => mocks.mockCheckApiKey(...args),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...args: unknown[]) =>
    mocks.mockAssertTrustedCsrf(...args),
  CsrfError: mocks.mockCsrfError,
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mocks.mockWriteAuditLog(...args),
}));

vi.mock("@/lib/ssrf", () => ({
  ssrfFetch: (...args: unknown[]) => mocks.mockSsrfFetch(...args),
  SsrfError: class SsrfError extends Error {},
}));

vi.mock("@/lib/maintenance/run", () => ({
  runMaintenance: (...args: unknown[]) => mocks.mockRunMaintenance(...args),
}));

vi.mock("@/lib/sources/health", () => ({
  getSourceHealth: (...args: unknown[]) => mocks.mockGetSourceHealth(...args),
  recordSuccessfulCheck: (...args: unknown[]) =>
    mocks.mockRecordSuccessfulCheck(...args),
  recordFailedCheck: (...args: unknown[]) =>
    mocks.mockRecordFailedCheck(...args),
  isSourceDueForCheck: (...args: unknown[]) =>
    mocks.mockIsSourceDueForCheck(...args),
}));

vi.mock("@/lib/ingestion/createJobDirect", () => ({
  createJobDirect: (...args: unknown[]) => mocks.mockCreateJobDirect(...args),
}));

vi.mock("@/lib/ingestion/batch", () => ({
  ingestJobs: (...args: unknown[]) => mocks.mockIngestJobs(...args),
}));

vi.mock("@/lib/validations", () => ({
  createJobSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateJobSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createSourceSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateSourceSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createOrganizationSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateOrganizationSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createCategorySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateCategorySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createProfessionSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateProfessionSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createLocationSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateLocationSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  createCareerArticleSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  updateCareerArticleSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/jobQuery", () => ({
  jobListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  jobIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/sourceQuery", () => ({
  sourceListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  dueListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/sourceParams", () => ({
  sourceIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/organizationQuery", () => ({
  organizationListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  organizationIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/categoryQuery", () => ({
  categoryListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  categoryIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/professionQuery", () => ({
  professionListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  professionIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/locationQuery", () => ({
  locationListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  locationIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/careerArticleQuery", () => ({
  careerArticleListQuerySchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
  careerArticleIdParamSchema: { safeParse: (d: unknown) => ({ success: true, data: d }) },
}));

vi.mock("@/lib/validations/batchIngestion", () => ({
  batchIngestionRequestSchema: {
    safeParse: (d: unknown) => ({ success: true, data: d }),
  },
}));

/* ── Helpers ────────────────────────────────────────────────────────────── */

function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const h = new Headers(headers);
  if (body !== undefined) {
    h.set("content-type", "application/json");
  }
  return new Request(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const API_KEY = "test-api-key";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGESTION_API_KEY", API_KEY);
  vi.stubEnv("INGESTION_ORGANIZATION_ID", VALID_ID);
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
  mocks.mockCheckApiKey.mockReturnValue({ ok: true });
  mocks.mockAssertTrustedCsrf.mockResolvedValue(true);
  mocks.mockWriteAuditLog.mockResolvedValue(undefined);
  mocks.mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
    }),
  });
  mocks.mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: VALID_ID }]),
      }),
    }),
  });
  mocks.mockDb.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const countResult = [{ count: 0 }];
  const dataRows: unknown[] = [];
  const whereChainable = {
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(countResult).then(resolve, reject);
    },
    orderBy: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue(dataRows),
      }),
    }),
  };
  mocks.mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereChainable),
    }),
  });
  mocks.mockDb.query.jobs.findFirst.mockResolvedValue({ id: VALID_ID, status: "DRAFT" });
  mocks.mockDb.query.sources.findFirst.mockResolvedValue({ id: VALID_ID, baseUrl: "https://example.com" });
  mocks.mockDb.query.organizations.findFirst.mockResolvedValue({ id: VALID_ID });
  mocks.mockDb.query.categories.findFirst.mockResolvedValue({ id: VALID_ID });
  mocks.mockDb.query.professions.findFirst.mockResolvedValue({ id: VALID_ID });
  mocks.mockDb.query.locations.findFirst.mockResolvedValue({ id: VALID_ID });
  mocks.mockDb.query.careerArticles.findFirst.mockResolvedValue({ id: VALID_ID });
  mocks.mockCreateJobDirect.mockResolvedValue({ id: VALID_ID });
  mocks.mockIngestJobs.mockResolvedValue({ created: 1, updated: 0, skipped: 0, failed: 0 });
  mocks.mockGetSourceHealth.mockResolvedValue({ sourceId: VALID_ID, lastSuccessfulCheck: null, lastAttemptedCheck: null, lastError: null, checkFrequencyMinutes: null, consecutiveFailures: 0 });
  mocks.mockRecordSuccessfulCheck.mockResolvedValue({ sourceId: VALID_ID });
  mocks.mockRecordFailedCheck.mockResolvedValue({ sourceId: VALID_ID });
  mocks.mockRunMaintenance.mockResolvedValue({ expired: 0, healthChecked: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ── CSRF protection ────────────────────────────────────────────────────── */

describe("CSRF protection on mutation routes", () => {
  it("POST /api/jobs rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { POST } = await import("@/app/api/jobs/route");
    const res = await POST(jsonRequest("POST", "http://localhost/api/jobs", {}));
    expect(res.status).toBe(403);
  });

  it("POST /api/sources rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { POST } = await import("@/app/api/sources/route");
    const res = await POST(jsonRequest("POST", "http://localhost/api/sources", {}));
    expect(res.status).toBe(403);
  });

  it("PUT /api/sources/[id] rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { PUT } = await import("@/app/api/sources/[id]/route");
    const res = await PUT(
      jsonRequest("PUT", `http://localhost/api/sources/${VALID_ID}`, {}),
      { params: Promise.resolve({ id: VALID_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("DELETE /api/sources/[id] rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { DELETE } = await import("@/app/api/sources/[id]/route");
    const res = await DELETE(
      jsonRequest("DELETE", `http://localhost/api/sources/${VALID_ID}`),
      { params: Promise.resolve({ id: VALID_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("PATCH /api/jobs/[id] rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { PATCH } = await import("@/app/api/jobs/[id]/route");
    const res = await PATCH(
      jsonRequest("PATCH", `http://localhost/api/jobs/${VALID_ID}`, {}),
      { params: Promise.resolve({ id: VALID_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/jobs/ingest rejects untrusted origin", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { POST } = await import("@/app/api/jobs/ingest/route");
    const res = await POST(jsonRequest("POST", "http://localhost/api/jobs/ingest", {}));
    expect(res.status).toBe(403);
  });

  it("POST /api/jobs succeeds with trusted origin", async () => {
    const { POST } = await import("@/app/api/jobs/route");
    const res = await POST(jsonRequest("POST", "http://localhost/api/jobs", {}));
    expect(res.status).toBe(201);
    expect(mocks.mockAssertTrustedCsrf).toHaveBeenCalled();
  });
});

/* ── Authentication on /api/sources/due ─────────────────────────────────── */

describe("Authentication on /api/sources/due", () => {
  it("rejects request without API key", async () => {
    mocks.mockCheckApiKey.mockReturnValue({ ok: false, status: 401, message: "Unauthorized" });
    const { GET } = await import("@/app/api/sources/due/route");
    const res = await GET(jsonRequest("GET", "http://localhost/api/sources/due"));
    expect(res.status).toBe(401);
  });

  it("accepts request with valid API key", async () => {
    mocks.mockDb.query.sources.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/sources/due/route");
    const res = await GET(jsonRequest("GET", "http://localhost/api/sources/due"));
    expect(res.status).toBe(200);
  });
});

/* ── LIKE-pattern escaping ──────────────────────────────────────────────── */

describe("LIKE-pattern escaping in job search", () => {
  it("escapes percent in search keyword", async () => {
    const { escapeLikePattern } = await import("@/lib/apiUtils");
    const escaped = escapeLikePattern("100%");
    expect(escaped).toBe("100\\%");
  });

  it("escapes underscore in search keyword", async () => {
    const { escapeLikePattern } = await import("@/lib/apiUtils");
    const escaped = escapeLikePattern("a_b");
    expect(escaped).toBe("a\\_b");
  });

  it("escapes backslash in search keyword", async () => {
    const { escapeLikePattern } = await import("@/lib/apiUtils");
    const escaped = escapeLikePattern("path\\to");
    expect(escaped).toBe("path\\\\to");
  });
});

/* ── Body-size limits ───────────────────────────────────────────────────── */

describe("Body-size limits", () => {
  it("rejects oversized payload on POST /api/jobs", async () => {
    const largeBody = "x".repeat(2 * 1024 * 1024);
    const req = new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(2 * 1024 * 1024),
      },
      body: JSON.stringify({ data: largeBody }),
    });
    const { POST } = await import("@/app/api/jobs/route");
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("accepts normal-sized payload on POST /api/jobs", async () => {
    const { POST } = await import("@/app/api/jobs/route");
    const res = await POST(jsonRequest("POST", "http://localhost/api/jobs", {}));
    expect(res.status).toBe(201);
  });
});

/* ── Audit logging ──────────────────────────────────────────────────────── */

describe("Audit logging on mutations", () => {
  it("writes audit log on POST /api/jobs", async () => {
    const { POST } = await import("@/app/api/jobs/route");
    await POST(jsonRequest("POST", "http://localhost/api/jobs", {}));
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_CREATED",
        targetType: "job",
      }),
    );
  });

  it("writes audit log on DELETE /api/jobs/[id]", async () => {
    const { DELETE } = await import("@/app/api/jobs/[id]/route");
    await DELETE(
      jsonRequest("DELETE", `http://localhost/api/jobs/${VALID_ID}`),
      { params: Promise.resolve({ id: VALID_ID }) },
    );
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_DELETED",
        targetType: "job",
        targetId: VALID_ID,
      }),
    );
  });

  it("writes audit log on POST /api/sources", async () => {
    const { POST } = await import("@/app/api/sources/route");
    await POST(jsonRequest("POST", "http://localhost/api/sources", {}));
    expect(mocks.mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SOURCE_CREATED",
        targetType: "source",
      }),
    );
  });

  it("does not write audit log when CSRF fails", async () => {
    mocks.mockAssertTrustedCsrf.mockRejectedValue(new mocks.mockCsrfError());
    const { POST } = await import("@/app/api/jobs/route");
    await POST(jsonRequest("POST", "http://localhost/api/jobs", {}));
    expect(mocks.mockWriteAuditLog).not.toHaveBeenCalled();
  });
});

/* ── Maintenance POST ───────────────────────────────────────────────────── */

describe("Maintenance endpoint method", () => {
  it("POST /api/internal/maintenance/run works with valid key", async () => {
    const { POST } = await import("@/app/api/internal/maintenance/run/route");
    const req = new Request("http://localhost/api/internal/maintenance/run", {
      method: "POST",
      headers: { "x-maintenance-key": "test-maintenance-key" },
    });
    vi.stubEnv("MAINTENANCE_API_KEY", "test-maintenance-key");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.mockRunMaintenance).toHaveBeenCalled();
  });

  it("POST /api/internal/maintenance/run rejects invalid key", async () => {
    vi.stubEnv("MAINTENANCE_API_KEY", "correct-key");
    const { POST } = await import("@/app/api/internal/maintenance/run/route");
    const req = new Request("http://localhost/api/internal/maintenance/run", {
      method: "POST",
      headers: { "x-maintenance-key": "wrong-key" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
