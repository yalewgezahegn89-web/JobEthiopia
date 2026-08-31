import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockCreateApplication: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockDispatchSubmission: vi.fn(),
  mockDbRow: vi.fn(),
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

vi.mock("@/lib/applications/dal", () => ({
  createApplication: (...a: unknown[]) => mocks.mockCreateApplication(...a),
}));

vi.mock("@/lib/email", () => ({
  dispatchApplicationSubmissionNotification: (...a: unknown[]) =>
    mocks.mockDispatchSubmission(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  limit: () => mocks.mockDbRow(),
                }),
              }),
            }),
          }),
        }),
      }),
    },
  };
});

import { POST } from "../route";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const ADMIN = { ...CANDIDATE, id: "u2", role: "ADMIN" };
const JOB_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function stubAuthed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCheckBodySize.mockReturnValue(null);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
}

function stubCandidateRow() {
  mocks.mockDbRow.mockResolvedValue([
    {
      candidateEmail: "candidate@example.com",
      candidateName: "Candidate",
      jobTitle: "Software Engineer",
      organizationName: "EthioTech",
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAuthed();
  stubCandidateRow();
  mocks.mockDispatchSubmission.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/applications", () => {
  it("creates an application and returns 201 for a candidate", async () => {
    mocks.mockCreateApplication.mockResolvedValue({
      ok: true,
      item: {
        id: "33333333-3333-4333-8333-333333333333",
        jobId: JOB_ID,
        status: "SUBMITTED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.item.status).toBe("SUBMITTED");
    expect(mocks.mockCreateApplication).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: JOB_ID, candidateUserId: CANDIDATE.id }),
    );
  });

  it("returns 401 when there is no session cookie", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(401);
    expect(mocks.mockCreateApplication).not.toHaveBeenCalled();
  });

  it("returns 401 when the session is invalid", async () => {
    mocks.mockVerifySession.mockResolvedValue(null);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a non-candidate role", async () => {
    mocks.mockVerifySession.mockResolvedValue(ADMIN);
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(403);
    expect(mocks.mockCreateApplication).not.toHaveBeenCalled();
  });

  it("returns 403 when CSRF validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("csrf"));
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(403);
    expect(mocks.mockCreateApplication).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid/missing jobId", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
    expect(mocks.mockCreateApplication).not.toHaveBeenCalled();
  });

  it("returns 400 when the cover letter exceeds the max length", async () => {
    const response = await POST(
      makeRequest({ jobId: JOB_ID, coverLetter: "x".repeat(2001) }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid JSON body", async () => {
    const req = new Request("http://localhost/api/applications", {
      method: "POST",
      body: "{not-json",
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the job is not found", async () => {
    mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "JOB_NOT_FOUND" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(404);
  });

  it("returns 422 when the job is not open", async () => {
    mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "JOB_NOT_OPEN" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(422);
  });

  it("returns 409 on a duplicate application", async () => {
    mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "DUPLICATE" });
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(409);
  });

  it("returns 500 on unexpected failure without leaking internals", async () => {
    mocks.mockCreateApplication.mockRejectedValue(new Error("db connection refused"));
    const response = await POST(makeRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("db connection refused");
  });

  it("rejects unknown extra fields (strict schema)", async () => {
    const response = await POST(makeRequest({ jobId: JOB_ID, evil: true }));
    expect(response.status).toBe(400);
    expect(mocks.mockCreateApplication).not.toHaveBeenCalled();
  });

  describe("observability", () => {
    it("logs application_submitted on success without PII", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mocks.mockCreateApplication.mockResolvedValue({
        ok: true,
        item: {
          id: "33333333-3333-4333-8333-333333333333",
          jobId: JOB_ID,
          status: "SUBMITTED",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });

      await POST(makeRequest({ jobId: JOB_ID, coverLetter: "secret-fit" }));
      const records = spy.mock.calls.map(([arg]) => JSON.stringify(arg));
      const raw = records.join(" ");
      expect(raw).toContain("application_submitted");
      expect(raw).not.toContain("candidate@example.com");
      expect(raw).not.toContain("secret-fit");
      expect(raw).not.toContain("11111111-1111-4111-8111-111111111111");
      spy.mockRestore();
    });

    it("logs a warning on duplicate submission", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "DUPLICATE" });
      await POST(makeRequest({ jobId: JOB_ID }));
      const raw = spy.mock.calls.map(([arg]) => JSON.stringify(arg)).join(" ");
      expect(raw).toContain("application_submitted_failed");
      expect(raw).toContain("DUPLICATE");
      spy.mockRestore();
    });
  });

  describe("confirmation email", () => {
    function successResult() {
      return {
        ok: true,
        item: {
          id: "33333333-3333-4333-8333-333333333333",
          jobId: JOB_ID,
          status: "SUBMITTED",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      };
    }

    it("sends one confirmation on a successful submission", async () => {
      mocks.mockCreateApplication.mockResolvedValue(successResult());
      const response = await POST(makeRequest({ jobId: JOB_ID }));
      expect(response.status).toBe(201);
      expect(mocks.mockDispatchSubmission).toHaveBeenCalledTimes(1);
    });

    it("derives the recipient from the authenticated candidate record", async () => {
      mocks.mockCreateApplication.mockResolvedValue(successResult());
      await POST(makeRequest({ jobId: JOB_ID }));
      expect(mocks.mockDispatchSubmission).toHaveBeenCalledWith(
        "candidate@example.com",
        expect.objectContaining({
          candidateName: "Candidate",
          jobTitle: "Software Engineer",
          organizationName: "EthioTech",
          applicationId: "33333333-3333-4333-8333-333333333333",
        }),
      );
    });

    it("does not send email on a duplicate application", async () => {
      mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "DUPLICATE" });
      const response = await POST(makeRequest({ jobId: JOB_ID }));
      expect(response.status).toBe(409);
      expect(mocks.mockDispatchSubmission).not.toHaveBeenCalled();
    });

    it("does not send email when creation fails", async () => {
      mocks.mockCreateApplication.mockResolvedValue({ ok: false, code: "JOB_NOT_OPEN" });
      await POST(makeRequest({ jobId: JOB_ID }));
      expect(mocks.mockDispatchSubmission).not.toHaveBeenCalled();
    });

    it("still returns 201 when the email provider fails", async () => {
      mocks.mockCreateApplication.mockResolvedValue(successResult());
      mocks.mockDispatchSubmission.mockRejectedValue(new Error("SMTP unreachable"));
      const response = await POST(makeRequest({ jobId: JOB_ID }));
      expect(response.status).toBe(201);
      expect(mocks.mockDispatchSubmission).toHaveBeenCalledTimes(1);
    });
  });
});
