import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockListEmployerApplications: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...a: unknown[]) => mocks.mockCookieGet(...a) }),
}));

vi.mock("@/lib/auth/session", () => ({
  verifySession: (...a: unknown[]) => mocks.mockVerifySession(...a),
}));

vi.mock("@/lib/employer/applications", () => ({
  listEmployerApplications: (...a: unknown[]) => mocks.mockListEmployerApplications(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { GET } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };

function makeRequest(query: Record<string, string> = {}): Request {
  const params = new URLSearchParams(query);
  return new Request(`http://localhost/api/employer/applications?${params}`);
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

describe("GET /api/employer/applications", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const response = await GET(makeRequest());
    expect(response.status).toBe(403);
  });

  it("returns applications for ORGANIZATION_ADMIN", async () => {
    mocks.mockListEmployerApplications.mockResolvedValue({
      items: [
        {
          id: "app-1",
          jobId: "job-1",
          jobTitle: "Engineer",
          organizationId: "org-1",
          organizationName: "Acme",
          candidateName: "Jane",
          candidateEmail: "jane@example.com",
          status: "SUBMITTED",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe("SUBMITTED");
  });

  it("passes sort parameter to DAL", async () => {
    mocks.mockListEmployerApplications.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

    await GET(makeRequest({ sort: "oldest" }));
    expect(mocks.mockListEmployerApplications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sort: "oldest" }),
    );
  });

  it("passes updated sort parameter to DAL", async () => {
    mocks.mockListEmployerApplications.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

    await GET(makeRequest({ sort: "updated" }));
    expect(mocks.mockListEmployerApplications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sort: "updated" }),
    );
  });

  it("defaults to newest sort", async () => {
    mocks.mockListEmployerApplications.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

    await GET(makeRequest());
    expect(mocks.mockListEmployerApplications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sort: "newest" }),
    );
  });

  it("passes jobId filter to DAL", async () => {
    mocks.mockListEmployerApplications.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    });

    await GET(makeRequest({ jobId: "44444444-4444-4444-8444-444444444444" }));
    expect(mocks.mockListEmployerApplications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ jobId: "44444444-4444-4444-8444-444444444444" }),
    );
  });
});
