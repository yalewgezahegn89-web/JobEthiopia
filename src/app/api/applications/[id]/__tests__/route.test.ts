import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockWithdraw: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...a: unknown[]) => mocks.mockCookieGet(...a) }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...a: unknown[]) => mocks.mockCsrf(...a),
}));

vi.mock("@/lib/applications/dal", () => ({
  withdrawApplication: (...a: unknown[]) => mocks.mockWithdraw(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { POST } from "../route";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const ADMIN = { ...CANDIDATE, id: "u2", role: "ADMIN" };
const APP_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(): Request {
  return new Request(`http://localhost/api/applications/${APP_ID}`, {
    method: "POST",
  });
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/applications/[id]", () => {
  function params() {
    return Promise.resolve({ id: APP_ID });
  }

  it("withdraws the candidate's application and returns success", async () => {
    mocks.mockWithdraw.mockResolvedValue({
      ok: true,
      item: { id: APP_ID, jobId: JOB_ID, status: "WITHDRAWN", updatedAt: new Date() },
    });
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(200);
    expect(mocks.mockWithdraw).toHaveBeenCalledWith(APP_ID, CANDIDATE.id);
  });

  it("returns 401 when there is no session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(401);
    expect(mocks.mockWithdraw).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-candidate role", async () => {
    mocks.mockVerifySession.mockResolvedValue(ADMIN);
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(403);
    expect(mocks.mockWithdraw).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(403);
    expect(mocks.mockWithdraw).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed id", async () => {
    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.mockWithdraw).not.toHaveBeenCalled();
  });

  it("returns 404 when the application is not found or owned by another candidate", async () => {
    mocks.mockWithdraw.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(404);
  });

  it("returns 409 when already withdrawn", async () => {
    mocks.mockWithdraw.mockResolvedValue({ ok: false, code: "ALREADY_WITHDRAWN" });
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(409);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockWithdraw.mockRejectedValue(new Error("boom"));
    const response = await POST(makeRequest(), { params: params() });
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("boom");
  });

  describe("observability", () => {
    it("logs application_withdrawn on success without PII", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mocks.mockWithdraw.mockResolvedValue({
        ok: true,
        item: { id: APP_ID, jobId: JOB_ID, status: "WITHDRAWN", updatedAt: new Date() },
      });
      await POST(makeRequest(), { params: params() });
      const raw = spy.mock.calls.map(([arg]) => JSON.stringify(arg)).join(" ");
      expect(raw).toContain("application_withdrawn");
      expect(raw).not.toContain("candidate@example.com");
      expect(raw).not.toContain("11111111-1111-4111-8111-111111111111");
      spy.mockRestore();
    });
  });
});
