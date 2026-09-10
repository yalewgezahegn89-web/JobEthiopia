import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockCookieGet: vi.fn(),
  mockVerifySession: vi.fn(),
  mockCsrf: vi.fn(),
  mockCheckBodySize: vi.fn(),
  mockCreateAlert: vi.fn(),
  mockListAlerts: vi.fn(),
  mockUpdateAlert: vi.fn(),
  mockDeleteAlert: vi.fn(),
  mockGetRequestId: vi.fn(),
  mockAudit: vi.fn(),
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

vi.mock("@/lib/jobAlerts/dal", () => ({
  createAlert: (...a: unknown[]) => mocks.mockCreateAlert(...a),
  listAlertsForUser: (...a: unknown[]) => mocks.mockListAlerts(...a),
  updateAlert: (...a: unknown[]) => mocks.mockUpdateAlert(...a),
  deleteAlert: (...a: unknown[]) => mocks.mockDeleteAlert(...a),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...a: unknown[]) => mocks.mockAudit(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { POST, GET } from "@/app/api/job-alerts/route";
import {
  PATCH as PatchOne,
  DELETE as DeleteOne,
} from "@/app/api/job-alerts/[alertId]/route";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};
const STAFF = { ...CANDIDATE, id: "u2", role: "ADMIN" };
const ALERT_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function authed() {
  mocks.mockCookieGet.mockReturnValue({ value: "valid-token" });
  mocks.mockVerifySession.mockResolvedValue(CANDIDATE);
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCheckBodySize.mockReturnValue(null);
  mocks.mockGetRequestId.mockResolvedValue("req-1");
}

beforeEach(() => {
  vi.clearAllMocks();
  authed();
  mocks.mockAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/job-alerts", () => {
  it("requires a session", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await POST(makeRequest("http://localhost/api/job-alerts", "POST", { name: "A" }));
    expect(res.status).toBe(401);
  });

  it("rejects non-candidates", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await POST(makeRequest("http://localhost/api/job-alerts", "POST", { name: "A" }));
    expect(res.status).toBe(403);
  });

  it("rejects when CSRF origin validation fails", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("origin"));
    const res = await POST(makeRequest("http://localhost/api/job-alerts", "POST", { name: "A" }));
    expect(res.status).toBe(403);
  });

  it("rejects invalid payloads", async () => {
    const res = await POST(makeRequest("http://localhost/api/job-alerts", "POST", { name: "" }));
    expect(res.status).toBe(400);
  });

  it("creates an alert for a candidate and audits", async () => {
    mocks.mockCreateAlert.mockResolvedValue({
      id: ALERT_ID,
      userId: CANDIDATE.id,
      name: "Auditor",
      frequency: "DAILY",
    });
    const res = await POST(
      makeRequest("http://localhost/api/job-alerts", "POST", { name: "Auditor" }),
    );
    expect(res.status).toBe(201);
    expect(mocks.mockCreateAlert).toHaveBeenCalledWith(
      CANDIDATE.id,
      expect.objectContaining({ name: "Auditor" }),
    );
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "JOB_ALERT_CREATED" }),
    );
  });
});

describe("GET /api/job-alerts", () => {
  it("lists the candidate's own alerts", async () => {
    mocks.mockListAlerts.mockResolvedValue([{ id: ALERT_ID }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });

  it("requires a session", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("rejects non-candidates", async () => {
    mocks.mockVerifySession.mockResolvedValue(STAFF);
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/job-alerts/[alertId]", () => {
  it("requires a session", async () => {
    mocks.mockCookieGet.mockReturnValue(undefined);
    const res = await PatchOne(
      makeRequest("http://localhost/api/job-alerts/x", "PATCH", { name: "A" }),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects a non-uuid alert id", async () => {
    const res = await PatchOne(
      makeRequest("http://localhost/api/job-alerts/not-a-uuid", "PATCH", { name: "A" }),
      { params: Promise.resolve({ alertId: "not-a-uuid" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when the alert is not owned", async () => {
    mocks.mockUpdateAlert.mockResolvedValue(null);
    const res = await PatchOne(
      makeRequest("http://localhost/api/job-alerts/abc", "PATCH", { status: "PAUSED" }),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("updates an owned alert", async () => {
    mocks.mockUpdateAlert.mockResolvedValue({
      id: ALERT_ID,
      status: "PAUSED",
      frequency: "DAILY",
    });
    const res = await PatchOne(
      makeRequest("http://localhost/api/job-alerts/abc", "PATCH", { status: "PAUSED" }),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdateAlert).toHaveBeenCalledWith(
      ALERT_ID,
      CANDIDATE.id,
      expect.objectContaining({ status: "PAUSED" }),
    );
  });
});

describe("DELETE /api/job-alerts/[alertId]", () => {
  it("deletes an owned alert with 204", async () => {
    mocks.mockDeleteAlert.mockResolvedValue(true);
    const res = await DeleteOne(
      makeRequest("http://localhost/api/job-alerts/abc", "DELETE"),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(204);
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "JOB_ALERT_DELETED" }),
    );
  });

  it("returns 404 when the alert is not owned", async () => {
    mocks.mockDeleteAlert.mockResolvedValue(false);
    const res = await DeleteOne(
      makeRequest("http://localhost/api/job-alerts/abc", "DELETE"),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it("requires CSRF", async () => {
    mocks.mockCsrf.mockRejectedValue(new Error("origin"));
    const res = await DeleteOne(
      makeRequest("http://localhost/api/job-alerts/abc", "DELETE"),
      { params: Promise.resolve({ alertId: ALERT_ID }) },
    );
    expect(res.status).toBe(403);
  });
});