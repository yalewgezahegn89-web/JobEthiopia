import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockListEmployerJobs: vi.fn(),
  mockCreateEmployerJob: vi.fn(),
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

vi.mock("@/lib/employer/jobs", () => ({
  listEmployerJobs: (...a: unknown[]) => mocks.mockListEmployerJobs(...a),
  createEmployerJob: (...a: unknown[]) => mocks.mockCreateEmployerJob(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { GET, POST } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { id: "u2", role: "CANDIDATE" };

function makeRequest(query: Record<string, string> = {}): Request {
  const params = new URLSearchParams(query);
  return new Request(`http://localhost/api/employer/jobs?${params}`);
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/employer/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

describe("GET /api/employer/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns jobs for ORGANIZATION_ADMIN", async () => {
    mocks.mockListEmployerJobs.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("returns application counts in response", async () => {
    mocks.mockListEmployerJobs.mockResolvedValue({
      items: [
        {
          id: "job-1",
          title: "Engineer",
          organizationId: "org-1",
          organizationName: "Acme",
          status: "PUBLISHED",
          deadline: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          applicationCount: 5,
          needsReviewCount: 2,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].applicationCount).toBe(5);
    expect(body.items[0].needsReviewCount).toBe(2);
  });
});

describe("POST /api/employer/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makePostRequest({ title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await POST(makePostRequest({ title: "Test" }));
    expect(res.status).toBe(403);
  });
});
