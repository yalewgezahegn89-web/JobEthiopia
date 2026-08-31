import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockUpdateNote: vi.fn(),
  mockDeleteNote: vi.fn(),
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
  updateApplicationNote: (...a: unknown[]) => mocks.mockUpdateNote(...a),
  deleteApplicationNote: (...a: unknown[]) => mocks.mockDeleteNote(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { PATCH, DELETE } from "../route";

const ORG_ADMIN = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@acme.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const CANDIDATE = { ...ORG_ADMIN, id: "u2", role: "CANDIDATE" };
const APP_A = "66666666-6666-4666-8666-666666666666";
const NOTE_1 = "88888888-8888-4888-8888-888888888888";

function makeNote() {
  return {
    id: NOTE_1,
    applicationId: APP_A,
    authorUserId: ORG_ADMIN.id,
    authorName: "Admin",
    authorActive: true,
    body: "Updated body",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  };
}

function params(applicationId = APP_A, noteId = NOTE_1) {
  return { params: Promise.resolve({ applicationId, noteId }) };
}

function makePatchRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/employer/applications/${APP_A}/notes/${NOTE_1}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
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

describe("PATCH /api/employer/applications/[applicationId]/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-org-admin roles", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid ids", async () => {
    const res = await PATCH(makePatchRequest({ body: "x" }), { params: Promise.resolve({ applicationId: "bad", noteId: "bad" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const res = await PATCH(makePatchRequest({ body: " " }), params());
    expect(res.status).toBe(400);
  });

  it("rejects forged authorUserId", async () => {
    const res = await PATCH(
      makePatchRequest({ body: "x", authorUserId: "forged", organizationId: "forged", candidateUserId: "forged" }),
      params(),
    );
    expect(res.status).toBe(400);
  });

  it("updates the actor's own note and returns 200", async () => {
    mocks.mockUpdateNote.mockResolvedValue({ ok: true, item: makeNote() });
    const res = await PATCH(makePatchRequest({ body: "Updated body" }), params());
    expect(res.status).toBe(200);
    expect(mocks.mockUpdateNote).toHaveBeenCalledWith(ORG_ADMIN.id, APP_A, NOTE_1, "Updated body");
  });

  it("returns 403 when editing another author's note", async () => {
    mocks.mockUpdateNote.mockResolvedValue({ ok: false, code: "NOTE_NOT_OWNED" });
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing note", async () => {
    mocks.mockUpdateNote.mockResolvedValue({ ok: false, code: "NOTE_NOT_FOUND" });
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(404);
  });

  it("returns 404 for a cross-org application", async () => {
    mocks.mockUpdateNote.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(404);
  });

  it("returns 500 without leaking DB errors", async () => {
    mocks.mockUpdateNote.mockResolvedValue({ ok: false, code: "NOTE_UPDATE_FAILED" });
    const res = await PATCH(makePatchRequest({ body: "x" }), params());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("DELETE /api/employer/applications/[applicationId]/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-org-admin roles", async () => {
    mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid ids", async () => {
    const res = await DELETE(new Request("http://localhost/x"), { params: Promise.resolve({ applicationId: "bad", noteId: "bad" }) });
    expect(res.status).toBe(400);
  });

  it("returns 204 on successful delete", async () => {
    mocks.mockDeleteNote.mockResolvedValue({ ok: true, removed: true });
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(204);
    expect(mocks.mockDeleteNote).toHaveBeenCalledWith(ORG_ADMIN.id, APP_A, NOTE_1);
  });

  it("returns 403 when deleting another author's note", async () => {
    mocks.mockDeleteNote.mockResolvedValue({ ok: false, code: "NOTE_NOT_OWNED" });
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing note", async () => {
    mocks.mockDeleteNote.mockResolvedValue({ ok: false, code: "NOTE_NOT_FOUND" });
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(404);
  });

  it("returns 404 for a cross-org application", async () => {
    mocks.mockDeleteNote.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await DELETE(new Request("http://localhost/x"), params());
    expect(res.status).toBe(404);
  });
});
