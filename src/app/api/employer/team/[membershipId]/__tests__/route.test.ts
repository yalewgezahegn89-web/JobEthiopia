import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockResolveMembership: vi.fn(),
  mockRemoveTeamMember: vi.fn(),
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

vi.mock("@/lib/employer/team", () => ({
  resolveEmployerTeamMembership: (...a: unknown[]) => mocks.mockResolveMembership(...a),
  removeEmployerTeamMember: (...a: unknown[]) => mocks.mockRemoveTeamMember(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { DELETE } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@acme.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };
const STAFF = { ...ORG_ADMIN, id: "u3", role: "ADMIN" };
const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "33333333-3333-4333-8333-333333333333";
const MEMBER_A = "44444444-4444-4444-8444-444444444444";
const MEMBER_B = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP = "66666666-6666-4666-8666-666666666666";

function makeRequest(): Request {
  return new Request(`http://localhost/api/employer/team/${MEMBERSHIP}`, {
    method: "DELETE",
  });
}

function params() {
  return { params: Promise.resolve({ membershipId: MEMBERSHIP }) };
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(ORG_ADMIN);
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

describe("DELETE /api/employer/team/[membershipId]", () => {
  it("removes a membership the actor manages and returns 204", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: MEMBER_A,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({ ok: true, removed: true });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(204);
    expect(mocks.mockRemoveTeamMember).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      ORG_A,
      MEMBER_A,
    );
  });

  it("returns 401 when unauthorized", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(401);
    expect(mocks.mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("returns 401 when session invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for wrong role", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 for staff", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(403);
    expect(mocks.mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid membershipId", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/employer/team/junk", { method: "DELETE" }),
      { params: Promise.resolve({ membershipId: "junk" }) } as never,
    );
    expect(res.status).toBe(400);
    expect(mocks.mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("returns 404 when membership does not exist", async () => {
    mocks.mockResolveMembership.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(404);
    expect(mocks.mockRemoveTeamMember).not.toHaveBeenCalled();
  });

  it("blocks cross-org IDOR: membership belongs to org B", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_B,
      targetUserId: MEMBER_B,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({
      ok: false,
      code: "ACTOR_NOT_AUTHORIZED",
    });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(403);
    // authorizes from the resolved org, not a client-supplied org id
    expect(mocks.mockRemoveTeamMember).toHaveBeenCalledWith(
      ORG_ADMIN.id,
      ORG_B,
      MEMBER_B,
    );
  });

  it("rejects inactive organization", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: MEMBER_A,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({
      ok: false,
      code: "ORGANIZATION_INACTIVE",
    });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(403);
  });

  it("enforces last-admin protection", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: MEMBER_A,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({ ok: false, code: "LAST_ADMIN" });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("at least one active administrator");
  });

  it("allows self-removal when another admin remains", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: ORG_ADMIN.id,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({ ok: true, removed: true });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(204);
  });

  it("blocks self-removal when last admin", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: ORG_ADMIN.id,
    });
    mocks.mockRemoveTeamMember.mockResolvedValue({ ok: false, code: "LAST_ADMIN" });
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(409);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockResolveMembership.mockResolvedValue({
      organizationId: ORG_A,
      targetUserId: MEMBER_A,
    });
    mocks.mockRemoveTeamMember.mockRejectedValue(new Error("boom"));
    const res = await DELETE(makeRequest(), params() as never);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("boom");
  });
});
