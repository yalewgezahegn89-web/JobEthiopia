import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockSaveJob: vi.fn(),
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

vi.mock("@/lib/apiUtils", () => ({
  checkBodySize: (...a: unknown[]) => mocks.mockCheckBodySize(...a),
}));

vi.mock("@/lib/savedJobs/dal", () => ({
  saveJob: (...a: unknown[]) => mocks.mockSaveJob(...a),
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
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/saved-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCheckBodySize.mockReturnValue(null);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/saved-jobs", () => {
  it("saves a job for an authenticated candidate and returns saved state without candidate identity", async () => {
    mocks.mockSaveJob.mockResolvedValue({ ok: true, saved: true, jobId: JOB_ID });

    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ saved: true, jobId: JOB_ID });
    expect(body.candidateUserId).toBeUndefined();
    expect(mocks.mockSaveJob).toHaveBeenCalledWith(CANDIDATE.id, JOB_ID);
  });

  it("returns 401 when there is no session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(401);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a staff/employer role", async () => {
    mocks.mockVerifySession.mockResolvedValue(ADMIN);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(403);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 403 for an ORGANIZATION_ADMIN role", async () => {
    mocks.mockVerifySession.mockResolvedValue({ ...ADMIN, role: "ORGANIZATION_ADMIN" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(403);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(403);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed jobId", async () => {
    const response = await POST(makeRequest({ jobId: "not-a-uuid" }));
    expect(response.status).toBe(400);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing jobId", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("rejects unknown extra fields (strict schema)", async () => {
    const response = await POST(makeRequest({ jobId: JOB_ID, candidateUserId: "evil" }));
    expect(response.status).toBe(400);
    expect(mocks.mockSaveJob).not.toHaveBeenCalled();
  });

  it("returns 404 when the job does not exist", async () => {
    mocks.mockSaveJob.mockResolvedValue({ ok: false, code: "JOB_NOT_FOUND" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(404);
  });

  it("returns 422 when the job is not saveable", async () => {
    mocks.mockSaveJob.mockResolvedValue({ ok: false, code: "JOB_NOT_SAVEABLE" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(422);
  });

  it("handles a duplicate save idempotently as success", async () => {
    mocks.mockSaveJob.mockResolvedValue({ ok: true, saved: true, jobId: JOB_ID });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(200);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockSaveJob.mockRejectedValue(new Error("db down"));
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("db down");
  });
});
