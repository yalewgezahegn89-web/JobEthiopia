import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockListTeam: vi.fn(),
  mockAddTeamMember: vi.fn(),
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

vi.mock("@/lib/employer/team", () => ({
  listEmployerTeam: (...a: unknown[]) => mocks.mockListTeam(...a),
  addEmployerTeamMember: (...a: unknown[]) => mocks.mockAddTeamMember(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { GET, POST } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@acme.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };
const STAFF = { ...ORG_ADMIN, id: "u3", role: "ADMIN" };
const ORG_A = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP = "44444444-4444-4444-8444-444444444444";

function makeItem() {
  return {
    membershipId: MEMBERSHIP,
    organizationId: ORG_A,
    organizationName: "Acme",
    userId: MEMBER,
    name: "Jane",
    email: "jane@acme.com",
    role: "ORGANIZATION_ADMIN",
    isActive: true,
    joinedAt: new Date(),
  };
}

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/employer/team", {
    method: "POST",
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
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/employer/team", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when session invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a candidate", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for staff", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(403);
  });

  it("returns safe team list for an org admin", async () => {
    mocks.mockListTeam.mockResolvedValue([makeItem()]);
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].role).toBe("ORGANIZATION_ADMIN");
    expect(body.items[0]).not.toHaveProperty("passwordHash");
    // GET uses no CSRF
    expect(mocks.mockCsrf).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockListTeam.mockRejectedValue(new Error("secret db error"));
    const res = await GET(new Request("http://localhost/api/employer/team"));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("secret db error");
  });
});

describe("POST /api/employer/team", () => {
  it("adds an organization admin by email and returns safe membership", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({ ok: true, item: makeItem() });
    const res = await POST(
      makePostRequest({ organizationId: ORG_A, email: "  Jane@Acme.COM " }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.organizationId).toBe(ORG_A);
    expect(body.item.email).toBe("jane@acme.com");
    // normalized email passed to DAL
    expect(mocks.mockAddTeamMember).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      ORG_A,
      "jane@acme.com",
    );
  });

  it("returns 401 when unauthorized", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(401);
    expect(mocks.mockAddTeamMember).not.toHaveBeenCalled();
  });

  it("returns 403 for wrong role", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(403);
    expect(mocks.mockAddTeamMember).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed organizationId", async () => {
    const res = await POST(makePostRequest({ organizationId: "junk", email: "jane@example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed email", async () => {
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects extra strict-schema keys", async () => {
    const res = await POST(
      makePostRequest({ organizationId: ORG_A, email: "jane@example.com", targetUserId: MEMBER }),
    );
    expect(res.status).toBe(400);
    expect(mocks.mockAddTeamMember).not.toHaveBeenCalled();
  });

  it("rejects forged organizationId (actor not in org)", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({
      ok: false,
      code: "ACTOR_NOT_AUTHORIZED",
    });
    const res = await POST(
      makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects inactive organization", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({
      ok: false,
      code: "ORGANIZATION_INACTIVE",
    });
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(403);
  });

  it("rejects nonexistent email with generic eligibility error", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({
      ok: false,
      code: "TARGET_USER_NOT_FOUND",
    });
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "nobody@x.com" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    // does not reveal whether the account exists
    expect(body.error).toContain("not eligible");
    expect(body.error).not.toContain("nobody");
  });

  it("rejects inactive target with generic eligibility error", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({
      ok: false,
      code: "TARGET_USER_INACTIVE",
    });
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(422);
  });

  it("rejects wrong-role target", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({
      ok: false,
      code: "TARGET_NOT_ORGANIZATION_ADMIN",
    });
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(422);
  });

  it("handles duplicate membership safely", async () => {
    mocks.mockAddTeamMember.mockResolvedValue({ ok: false, code: "ALREADY_MEMBER" });
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(409);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockAddTeamMember.mockRejectedValue(new Error("db down"));
    const res = await POST(makePostRequest({ organizationId: ORG_A, email: "jane@example.com" }));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("db down");
  });
});
