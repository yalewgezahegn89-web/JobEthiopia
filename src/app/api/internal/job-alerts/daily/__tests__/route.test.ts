import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockAudit: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("@/lib/jobAlerts/delivery", () => ({
  dispatchDailyDigests: (...a: unknown[]) => mocks.mockDispatch(...a),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...a: unknown[]) => mocks.mockAudit(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...a: unknown[]) => mocks.mockGetRequestId(...a),
}));

import { POST } from "@/app/api/internal/job-alerts/daily/route";

const KEY = "test-secret-key-abc";
const RESULT = {
  alertsProcessed: 2,
  alertsSkipped: 0,
  sent: 3,
  skippedNoEmail: 1,
  failed: 0,
  emailsSent: 1,
};

function makeRequest(key?: string): Request {
  return new Request("http://localhost/api/internal/job-alerts/daily", {
    method: "POST",
    ...(key ? { headers: { "x-maintenance-key": key } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetRequestId.mockResolvedValue("req-1");
  vi.stubEnv("MAINTENANCE_API_KEY", KEY);
  mocks.mockDispatch.mockResolvedValue(RESULT);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/internal/job-alerts/daily", () => {
  it("rejects when the server has no key configured", async () => {
    vi.stubEnv("MAINTENANCE_API_KEY", "");
    const res = await POST(makeRequest(KEY));
    expect(res.status).toBe(500);
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("rejects a missing key", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("rejects a wrong key", async () => {
    const res = await POST(makeRequest("wrong-key"));
    expect(res.status).toBe(401);
    expect(mocks.mockDispatch).not.toHaveBeenCalled();
  });

  it("runs the digest with the correct key and audits the result", async () => {
    const res = await POST(makeRequest(KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(RESULT);
    expect(mocks.mockDispatch).toHaveBeenCalledOnce();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "JOB_ALERT_DIGEST_RUN" }),
    );
  });

  it("returns 500 when the digest throws", async () => {
    mocks.mockDispatch.mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest(KEY));
    expect(res.status).toBe(500);
  });
});