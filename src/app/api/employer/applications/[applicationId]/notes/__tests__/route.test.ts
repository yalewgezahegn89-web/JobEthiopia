import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockListNotes: vi.fn(),
  mockCreateNote: vi.fn(),
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

vi.mock("@/lib/employer/applicationNotes", () => ({
  listApplicationNotes: (...a: unknown[]) => mocks.mockListNotes(...a),
  createApplicationNote: (...a: unknown[]) => mocks.mockCreateNote(...a),
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
const APP_A = "66666666-6666-4666-8666-666666666666";
const NOTE_1 = "88888888-8888-4888-8888-888888888888";

function makeNote() {
  return {
    id: NOTE_1,
    applicationId: APP_A,
    authorUserId: ORG_ADMIN.id,
    authorName: "Admin",
    authorActive: true,
    body: "Strong candidate",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function params(applicationId = APP_A) {
  return { params: Promise.resolve({ applicationId }) };
}

function makePostRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/employer/applications/${APP_A}/notes`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
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

describe("GET /api/employer/applications/[applicationId]/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-org-admin roles", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid application id", async () => {
    const res = await GET(new Request("http://localhost/x"), params("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("GET uses no CSRF", async () => {
    mocks.mockListNotes.mockResolvedValue({ ok: true, item: [] });
    await GET(new Request("http://localhost/x"), params());
    expect(mocks.mockCsrf).not.toHaveBeenCalled();
  });

  it("returns safe note list for an org admin", async () => {
    mocks.mockListNotes.mockResolvedValue({ ok: true, item: [makeNote()] });
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].body).toBe("Strong candidate");
    expect(body.items[0]).not.toHaveProperty("candidateUserId");
    expect(body.items[0]).not.toHaveProperty("email");
  });

  it("returns 403 when the employer is not authorized", async () => {
    mocks.mockListNotes.mockResolvedValue({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 403 for an inactive organization", async () => {
    mocks.mockListNotes.mockResolvedValue({ ok: false, code: "ORGANIZATION_INACTIVE" });
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing / cross-org application", async () => {
    mocks.mockListNotes.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(404);
  });

  it("returns 500 without leaking DB errors", async () => {
    mocks.mockListNotes.mockRejectedValue(new Error("secret db error"));
    const res = await GET(new Request("http://localhost/x"), params());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret db error");
  });
});

describe("POST /api/employer/applications/[applicationId]/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-org-admin roles", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid application id", async () => {
    const res = await POST(makePostRequest({ body: "x" }), { params: Promise.resolve({ applicationId: "bad" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const res = await POST(makePostRequest({ body: " " }), params());
    expect(res.status).toBe(400);
  });

  it("returns 400 for an over-long body", async () => {
    const res = await POST(makePostRequest({ body: "x".repeat(4001) }), params());
    expect(res.status).toBe(400);
  });

  it("rejects unknown strict keys", async () => {
    const res = await POST(makePostRequest({ body: "x", authorUserId: "forged" }), params());
    expect(res.status).toBe(400);
  });

  it("creates a note and returns 201", async () => {
    mocks.mockCreateNote.mockResolvedValue({ ok: true, item: makeNote() });
    const res = await POST(makePostRequest({ body: "Strong candidate" }), params());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.body).toBe("Strong candidate");
    // author always derived server-side, never from client
    expect(mocks.mockCreateNote).toHaveBeenCalledWith(ORG_ADMIN.id, APP_A, "Strong candidate");
  });

  it("returns 404 when the application is not found", async () => {
    mocks.mockCreateNote.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the employer is not authorized", async () => {
    mocks.mockCreateNote.mockResolvedValue({ ok: false, code: "EMPLOYER_NOT_AUTHORIZED" });
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 500 without leaking DB errors", async () => {
    mocks.mockCreateNote.mockResolvedValue({ ok: false, code: "NOTE_CREATE_FAILED" });
    const res = await POST(makePostRequest({ body: "x" }), params());
    expect(res.status).toBe(500);
  });
});
