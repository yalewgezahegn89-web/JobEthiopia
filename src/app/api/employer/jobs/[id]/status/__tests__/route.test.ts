import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockChangeEmployerJobStatus: vi.fn(),
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
  changeEmployerJobStatus: (...a: unknown[]) =>
    mocks.mockChangeEmployerJobStatus(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { PATCH } from "../route";

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

describe("PATCH /api/employer/jobs/[id]/status", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue({ id: "u2", role: "CANDIDATE" });
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid status value", async () => {
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 404 when job not found", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 for invalid transition", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: false,
      code: "INVALID_TRANSITION",
    });
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 200 on successful status change", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "PENDING_REVIEW" }),
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: JOB_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("PENDING_REVIEW");
  });
});
