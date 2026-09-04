import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockListEmployerJobs: vi.fn(),
  mockCreateEmployerJob: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockAssertTrustedCsrfFromRequest: vi.fn(),
  mockCheckBodySize: vi.fn(),
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

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...a: unknown[]) =>
    mocks.mockAssertTrustedCsrfFromRequest(...a),
}));

vi.mock("@/lib/apiUtils", () => ({
  checkBodySize: (...a: unknown[]) => mocks.mockCheckBodySize(...a),
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
  mocks.mockAssertTrustedCsrfFromRequest.mockResolvedValue(undefined);
  mocks.mockCheckBodySize.mockReturnValue(undefined);
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
  const VALID_BODY = {
    organizationId: "22222222-2222-4222-8222-222222222222",
    title: "Software Engineer",
    description: "Build great things",
  };

  const CREATED_ITEM = {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Software Engineer",
    slug: "software-engineer",
    organizationId: "22222222-2222-4222-8222-222222222222",
    organizationName: "Acme Corp",
    description: "Build great things",
    status: "DRAFT",
    verificationStatus: "PENDING",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 401 when session is invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-ORGANIZATION_ADMIN", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockAssertTrustedCsrfFromRequest.mockRejectedValue(
      new Error("CSRF rejected"),
    );
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 422 for missing title", async () => {
    const res = await POST(
      makePostRequest({
        organizationId: VALID_BODY.organizationId,
        description: VALID_BODY.description,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("title");
  });

  it("returns 422 for missing description", async () => {
    const res = await POST(
      makePostRequest({
        organizationId: VALID_BODY.organizationId,
        title: VALID_BODY.title,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("description");
  });

  it("returns 422 for missing organizationId", async () => {
    const res = await POST(
      makePostRequest({
        title: VALID_BODY.title,
        description: VALID_BODY.description,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("organizationId");
  });

  it("returns 422 for malformed organizationId", async () => {
    const res = await POST(
      makePostRequest({
        organizationId: "not-a-uuid",
        title: VALID_BODY.title,
        description: VALID_BODY.description,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for salaryMax < salaryMin", async () => {
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        salaryMin: 5000,
        salaryMax: 3000,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("salaryMax");
  });

  it("returns 422 for experienceMax < experienceMin", async () => {
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        experienceMin: 5,
        experienceMax: 2,
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("experienceMax");
  });

  it("returns 422 for unknown fields (strict schema)", async () => {
    const res = await POST(
      makePostRequest({
        ...VALID_BODY,
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 403 when organization is inactive", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: false,
      code: "ORG_INACTIVE",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("not active");
  });

  it("returns 403 when employer lacks org membership", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("returns 409 on slug collision", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: false,
      code: "SLUG_COLLISION",
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
  });

  it("returns 201 on successful creation", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(201);
  });

  it("response contains created item", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    const body = await res.json();
    expect(body.item).toBeDefined();
    expect(body.item.id).toBe(CREATED_ITEM.id);
    expect(body.item.title).toBe(CREATED_ITEM.title);
  });

  it("created item has DRAFT status", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    const body = await res.json();
    expect(body.item.status).toBe("DRAFT");
  });

  it("server-generated values are present in response", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    const res = await POST(makePostRequest(VALID_BODY));
    const body = await res.json();
    expect(body.item.slug).toBeDefined();
    expect(body.item.createdAt).toBeDefined();
    expect(body.item.updatedAt).toBeDefined();
  });

  it("passes authenticated user.id to DAL, not client-supplied value", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    await POST(makePostRequest(VALID_BODY));
    expect(mocks.mockCreateEmployerJob).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      expect.objectContaining({
        organizationId: VALID_BODY.organizationId,
        title: VALID_BODY.title,
        description: VALID_BODY.description,
      }),
    );
  });

  it("does not pass status or verificationStatus to DAL", async () => {
    mocks.mockCreateEmployerJob.mockResolvedValue({
      ok: true,
      item: CREATED_ITEM,
    });
    await POST(makePostRequest(VALID_BODY));
    const callArgs = mocks.mockCreateEmployerJob.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty("status");
    expect(callArgs).not.toHaveProperty("verificationStatus");
  });
});
