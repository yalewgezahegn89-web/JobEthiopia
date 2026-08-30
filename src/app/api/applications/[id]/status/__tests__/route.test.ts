import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockAssertAccess: vi.fn(),
  mockChangeStatus: vi.fn(),
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

vi.mock("@/lib/auth/employerAccess", () => ({
  assertEmployerApplicationAccess: (...a: unknown[]) => mocks.mockAssertAccess(...a),
}));

vi.mock("@/lib/employer/applications", () => ({
  changeEmployerApplicationStatus: (...a: unknown[]) => mocks.mockChangeStatus(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { PATCH } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };
const APP_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/applications/${APP_ID}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(ORG_ADMIN);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCheckBodySize.mockReturnValue(null);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
  mocks.mockAssertAccess.mockResolvedValue({
    ok: true,
    applicationId: APP_ID,
    organizationId: "org-1",
  });
}

function params() {
  return Promise.resolve({ id: APP_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PATCH /api/applications/[id]/status", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(403);
  });

  it("returns 422 for invalid status value", async () => {
    const response = await PATCH(makeRequest({ status: "INVALID" }), { params: params() });
    expect(response.status).toBe(422);
  });

  it("returns 400 for invalid UUID", async () => {
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 when application not found", async () => {
    mocks.mockAssertAccess.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(404);
  });

  it("returns 403 when access denied", async () => {
    mocks.mockAssertAccess.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(403);
  });

  it("changes status on success", async () => {
    mocks.mockChangeStatus.mockResolvedValue({
      ok: true,
      item: { id: APP_ID, status: "REVIEWING" },
    });
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.item.status).toBe("REVIEWING");
  });

  it("returns 409 for invalid transition", async () => {
    mocks.mockChangeStatus.mockResolvedValue({
      ok: false,
      code: "INVALID_TRANSITION",
    });
    const response = await PATCH(makeRequest({ status: "REVIEWING" }), { params: params() });
    expect(response.status).toBe(409);
  });
});
