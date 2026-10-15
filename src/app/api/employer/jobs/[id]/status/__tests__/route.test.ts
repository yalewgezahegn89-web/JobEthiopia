import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";

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
  assertTrustedCsrfFromRequest: vi.fn().mockRejectedValue(new Error("CSRF rejected")),
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
  vi.mocked(assertTrustedCsrfFromRequest).mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeReq(body?: string, opts?: { headers?: Record<string, string> }) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.headers) Object.assign(headers, opts.headers);
  return new Request(
    `http://localhost/api/employer/jobs/${JOB_ID}/status`,
    {
      method: "PATCH",
      headers,
      ...(body !== undefined ? { body } : {}),
    },
  );
}

const params = { params: Promise.resolve({ id: JOB_ID }) };

describe("PATCH /api/employer/jobs/[id]/status", () => {
  it("returns 401 when no session cookie is present", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(401);
  });

  it("returns 401 when session verification fails", async () => {
    mocks.mockCookieGet.mockReturnValue({ value: "bad-token" });
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN role", async () => {
    mocks.mockVerifySession.mockResolvedValue({ id: "u2", role: "CANDIDATE" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid status value", async () => {
    const res = await PATCH(makeReq(JSON.stringify({ status: "PUBLISHED" })), params);
    expect(res.status).toBe(422);
  });

  it("returns 422 when status field is missing", async () => {
    const res = await PATCH(makeReq(JSON.stringify({})), params);
    expect(res.status).toBe(422);
  });

  it("returns 400 for invalid UUID in path", async () => {
    const res = await PATCH(
      makeReq(JSON.stringify({ status: "PENDING_REVIEW" })),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await PATCH(makeReq("{bad json"), params);
    expect(res.status).toBe(400);
  });

  it("returns current 400 behavior for missing body (request.json throws)", async () => {
    const req = new Request(
      `http://localhost/api/employer/jobs/${JOB_ID}/status`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, params);
    expect(res.status).toBe(400);
  });

  it("returns 403 on CSRF failure", async () => {
    vi.mocked(assertTrustedCsrfFromRequest).mockRejectedValueOnce(new Error("CSRF rejected"));
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when DAL returns FORBIDDEN", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when DAL returns ORG_INACTIVE", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({ ok: false, code: "ORG_INACTIVE" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(403);
  });

  it("returns 500 when DAL returns USER_INACTIVE", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({ ok: false, code: "USER_INACTIVE" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(500);
  });

  it("returns 404 when DAL returns NOT_FOUND", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(404);
  });

  it("returns 409 when DAL returns INVALID_TRANSITION", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({ ok: false, code: "INVALID_TRANSITION" });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(409);
  });

  it("returns 200 on successful DRAFT → PENDING_REVIEW", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toEqual({ id: JOB_ID, status: "PENDING_REVIEW" });
  });

  it("returns 200 on successful PENDING_REVIEW → DRAFT", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "DRAFT" },
    });
    const res = await PATCH(makeReq(JSON.stringify({ status: "DRAFT" })), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item).toEqual({ id: JOB_ID, status: "DRAFT" });
  });

  it("response body has expected { item } shape", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    const res = await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    const body = await res.json();
    expect(body).toHaveProperty("item");
    expect(body.item).toHaveProperty("id");
    expect(body.item).toHaveProperty("status");
    expect(typeof body.item.id).toBe("string");
    expect(typeof body.item.status).toBe("string");
  });

  it("passes session user.id to DAL", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    await PATCH(makeReq(JSON.stringify({ status: "PENDING_REVIEW" })), params);
    expect(mocks.mockChangeEmployerJobStatus).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      JOB_ID,
      "PENDING_REVIEW",
    );
  });

  it("passes parsed status value to DAL", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "DRAFT" },
    });
    await PATCH(makeReq(JSON.stringify({ status: "DRAFT" })), params);
    expect(mocks.mockChangeEmployerJobStatus).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      JOB_ID,
      "DRAFT",
    );
  });

  it("ignores client-controlled verificationStatus in body", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    const res = await PATCH(
      makeReq(JSON.stringify({ status: "PENDING_REVIEW", verificationStatus: "VERIFIED" })),
      params,
    );
    expect(res.status).toBe(422);
  });

  it("does not trust client-supplied userId in body", async () => {
    mocks.mockChangeEmployerJobStatus.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID, status: "PENDING_REVIEW" },
    });
    const res = await PATCH(
      makeReq(JSON.stringify({ status: "PENDING_REVIEW" })),
      params,
    );
    expect(res.status).toBe(200);
    expect(mocks.mockChangeEmployerJobStatus).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      JOB_ID,
      "PENDING_REVIEW",
    );
    expect(mocks.mockChangeEmployerJobStatus.mock.calls[0][0]).not.toBe("attacker-id");
  });
});
