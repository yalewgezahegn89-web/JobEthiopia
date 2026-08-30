import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockGetEmployerJob: vi.fn(),
  mockUpdateEmployerJob: vi.fn(),
  mockRemoveEmployerJob: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (...a: unknown[]) => mocks.mockCookieGet(...a),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/employer/jobs", () => ({
  getEmployerJob: (...a: unknown[]) => mocks.mockGetEmployerJob(...a),
  updateEmployerJob: (...a: unknown[]) => mocks.mockUpdateEmployerJob(...a),
  removeEmployerJob: (...a: unknown[]) => mocks.mockRemoveEmployerJob(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { GET, PATCH, DELETE } from "../route";

const JOB_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ORGANIZATION_ADMIN",
};

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(ORG_ADMIN);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/employer/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`);
    const res = await GET(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when job not found", async () => {
    mocks.mockGetEmployerJob.mockResolvedValue(null);
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`);
    const res = await GET(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns job detail for authorized employer", async () => {
    mocks.mockGetEmployerJob.mockResolvedValue({
      id: JOB_ID,
      title: "Software Engineer",
      slug: "software-engineer",
      organizationId: "org-1",
      organizationName: "Test Org",
      description: "A great job",
      status: "DRAFT",
      verificationStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`);
    const res = await GET(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.title).toBe("Software Engineer");
  });
});

describe("PATCH /api/employer/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 409 when job status blocks editing", async () => {
    mocks.mockUpdateEmployerJob.mockResolvedValue({
      ok: false,
      code: "STATUS_BLOCKED",
    });
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(409);
  });

  it("returns 200 on successful update", async () => {
    mocks.mockUpdateEmployerJob.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, updatedAt: new Date() },
    });
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/employer/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 409 when job status blocks removal", async () => {
    mocks.mockRemoveEmployerJob.mockResolvedValue({
      ok: false,
      code: "STATUS_BLOCKED",
    });
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(409);
  });

  it("returns 200 on successful removal", async () => {
    mocks.mockRemoveEmployerJob.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "REMOVED" },
    });
    const req = new Request(`http://localhost/api/employer/jobs/${JOB_ID}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(200);
  });
});
