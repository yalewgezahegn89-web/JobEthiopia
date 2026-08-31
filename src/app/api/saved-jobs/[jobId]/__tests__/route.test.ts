import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockUnsaveJob: vi.fn(),
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

vi.mock("@/lib/savedJobs/dal", () => ({
  unsaveJob: (...a: unknown[]) => mocks.mockUnsaveJob(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { DELETE } from "../route";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const STAFF = { ...CANDIDATE, id: "u2", role: "MODERATOR" };
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(): Request {
  return new Request(`http://localhost/api/saved-jobs/${JOB_ID}`, {
    method: "DELETE",
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

describe("DELETE /api/saved-jobs/[jobId]", () => {
  it("unsaves a job for an authenticated candidate and returns 204", async () => {
    mocks.mockUnsaveJob.mockResolvedValue({ ok: true });
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(204);
    expect(mocks.mockUnsaveJob).toHaveBeenCalledWith(CANDIDATE.id, JOB_ID);
  });

  it("returns 401 when there is no session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(401);
    expect(mocks.mockUnsaveJob).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a staff role", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(403);
    expect(mocks.mockUnsaveJob).not.toHaveBeenCalled();
  });

  it("returns 403 for an employer role", async () => {
    mocks.mockVerifySession.mockResolvedValue({ ...STAFF, role: "ORGANIZATION_ADMIN" });
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(403);
    expect(mocks.mockUnsaveJob).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(403);
    expect(mocks.mockUnsaveJob).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid jobId", async () => {
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: "junk" }) });
    expect(response.status).toBe(400);
    expect(mocks.mockUnsaveJob).not.toHaveBeenCalled();
  });

  it("treats a missing save as idempotent success (204)", async () => {
    mocks.mockUnsaveJob.mockResolvedValue({ ok: true });
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(204);
  });

  it("returns 500 on unexpected failure", async () => {
    mocks.mockUnsaveJob.mockRejectedValue(new Error("boom"));
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ jobId: JOB_ID }) });
    expect(response.status).toBe(500);
  });
});
