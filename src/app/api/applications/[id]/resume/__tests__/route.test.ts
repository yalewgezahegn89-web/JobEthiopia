import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResumeStorageError } from "@/lib/resume/storage";
import { ResumeValidationError } from "@/lib/resume/validation";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockUpload: vi.fn(),
  mockDelete: vi.fn(),
  mockCandidateDownload: vi.fn(),
  mockEmployerDownload: vi.fn(),
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

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/lib/resume/service", () => ({
  uploadApplicationResume: (...a: unknown[]) => mocks.mockUpload(...a),
  deleteApplicationResume: (...a: unknown[]) => mocks.mockDelete(...a),
  downloadApplicationResumeForCandidate: (...a: unknown[]) =>
    mocks.mockCandidateDownload(...a),
  downloadApplicationResumeForEmployer: (...a: unknown[]) =>
    mocks.mockEmployerDownload(...a),
}));

import { GET, POST, DELETE } from "../route";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const ORG_ADMIN = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "admin@org.com",
  name: "Admin",
  role: "ORGANIZATION_ADMIN",
};
const STAFF = { ...CANDIDATE, id: "u3", role: "STAFF" };
const APP_ID = "33333333-3333-4333-8333-333333333333";

function params() {
  return Promise.resolve({ id: APP_ID });
}

function pdfStream() {
  return new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("%PDF-1.7"));
      c.close();
    },
  });
}

function download() {
  return {
    ok: true,
    download: {
      resume: {
        id: "99999999-9999-4999-8999-999999999999",
        applicationId: APP_ID,
        objectKey: "resumes/key.pdf",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        size: 42,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      body: pdfStream(),
      contentType: "application/pdf",
      contentLength: 8,
    },
  };
}

function makeUploadRequest(withFile = true): Request {
  const form = new FormData();
  if (withFile) {
    form.append("file", new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" }));
  }
  return new Request(`http://localhost/api/applications/${APP_ID}/resume`, {
    method: "POST",
    body: form,
  });
}

function stubAuthed(user = CANDIDATE) {
  mocks.mockCookieGet.mockReturnValue({ value: "token" });
  mocks.mockVerifySession.mockResolvedValue(user);
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

describe("GET /api/applications/[id]/resume", () => {
  it("returns 401 without a session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid session", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-candidate/admin role", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await GET(new Request(`http://localhost/api/applications/x/resume`), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when no resume is found", async () => {
    mocks.mockCandidateDownload.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(404);
  });

  it("streams the candidate's PDF with safe headers", async () => {
    mocks.mockCandidateDownload.mockResolvedValue(download());
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition.startsWith("attachment")).toBe(true);
    expect(disposition).toContain("filename*=UTF-8''");
  });

  it("streams for an authorized employer", async () => {
    stubAuthed(ORG_ADMIN);
    mocks.mockEmployerDownload.mockResolvedValue(download());
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(200);
    expect(mocks.mockEmployerDownload).toHaveBeenCalledWith(APP_ID, ORG_ADMIN.id);
  });

  it("returns 503 when storage is not configured", async () => {
    mocks.mockCandidateDownload.mockRejectedValue(
      new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED"),
    );
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("configuration");
  });

  it("returns 500 on storage fetch failure without leaking internals", async () => {
    mocks.mockCandidateDownload.mockRejectedValue(
      new ResumeStorageError("RESUME_STORAGE_FETCH_FAILED"),
    );
    const res = await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("FETCH_FAILED");
  });
});

describe("POST /api/applications/[id]/resume", () => {
  it("returns 401 without a session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-candidate role", async () => {
    stubAuthed(ORG_ADMIN);
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(403);
    expect(mocks.mockUpload).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(403);
    expect(mocks.mockUpload).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed id", async () => {
    const res = await POST(makeUploadRequest(), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when no file is provided", async () => {
    const res = await POST(makeUploadRequest(false), { params: params() });
    expect(res.status).toBe(400);
    expect(mocks.mockUpload).not.toHaveBeenCalled();
  });

  it("creates a resume and returns 201 with safe metadata only", async () => {
    mocks.mockUpload.mockResolvedValue({
      ok: true,
      created: true,
      resume: {
        id: "99999999-9999-4999-8999-999999999999",
        applicationId: APP_ID,
        objectKey: "resumes/key.pdf",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        size: 42,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.objectKey).toBeUndefined();
    expect(body.item.originalName).toBe("cv.pdf");
  });

  it("returns 200 when a resume is replaced", async () => {
    mocks.mockUpload.mockResolvedValue({
      ok: true,
      created: false,
      resume: {
        id: "99999999-9999-4999-8999-999999999999",
        applicationId: APP_ID,
        objectKey: "resumes/key.pdf",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        size: 42,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(200);
  });

  it("returns 404 when the application is not owned", async () => {
    mocks.mockUpload.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(404);
  });

  it("returns 413 for a TOO_LARGE validation error", async () => {
    mocks.mockUpload.mockRejectedValue(new ResumeValidationError("TOO_LARGE"));
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(413);
  });

  it("returns 422 for an invalid signature", async () => {
    mocks.mockUpload.mockRejectedValue(new ResumeValidationError("INVALID_SIGNATURE"));
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(422);
  });

  it("returns 503 when storage is not configured", async () => {
    mocks.mockUpload.mockRejectedValue(
      new ResumeStorageError("RESUME_STORAGE_NOT_CONFIGURED"),
    );
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(503);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockUpload.mockRejectedValue(new Error("secret-boom"));
    const res = await POST(makeUploadRequest(), { params: params() });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret-boom");
  });
});

describe("DELETE /api/applications/[id]/resume", () => {
  it("returns 401 without a session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-candidate role", async () => {
    stubAuthed(STAFF);
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(403);
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(403);
  });

  it("deletes and returns success", async () => {
    mocks.mockDelete.mockResolvedValue({ ok: true, deleted: true });
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deleted: true });
  });

  it("returns 404 when the application is not owned", async () => {
    mocks.mockDelete.mockResolvedValue({ ok: false, code: "APPLICATION_NOT_FOUND" });
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockDelete.mockRejectedValue(new Error("boom"));
    const res = await DELETE(new Request(`http://localhost/api/applications/${APP_ID}/resume`, { method: "DELETE" }), { params: params() });
    expect(res.status).toBe(500);
  });
});

describe("observability", () => {
  it("logs resume upload success without PII or object keys", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.mockUpload.mockResolvedValue({
      ok: true,
      created: true,
      resume: {
        id: "99999999-9999-4999-8999-999999999999",
        applicationId: APP_ID,
        objectKey: "resumes/secret-key.pdf",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        size: 42,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await POST(makeUploadRequest(), { params: params() });
    const raw = spy.mock.calls.map(([a]) => JSON.stringify(a)).join(" ");
    expect(raw).toContain("resume_upload_succeeded");
    expect(raw).not.toContain("candidate@example.com");
    expect(raw).not.toContain("secret-key.pdf");
    expect(raw).not.toContain("resumes/");
    spy.mockRestore();
  });

  it("logs download failures with neutral error codes only", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.mockCandidateDownload.mockRejectedValue(new Error("raw-db-detail"));
    await GET(new Request(`http://localhost/api/applications/${APP_ID}/resume`), { params: params() });
    const raw = spy.mock.calls.map(([a]) => JSON.stringify(a)).join(" ");
    expect(raw).toContain("resume_download_failed");
    expect(raw).not.toContain("raw-db-detail");
    spy.mockRestore();
  });
});
