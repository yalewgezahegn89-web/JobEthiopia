import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockDispatchDailyDigests: vi.fn(),
  mockCheckInternalKey: vi.fn(),
  mockAudit: vi.fn(),
  mockReportError: vi.fn(),
  mockLogInfo: vi.fn(),
  mockGetRequestId: vi.fn().mockResolvedValue("req-test-123"),
}));

vi.mock("@/lib/jobAlerts/delivery", () => ({
  dispatchDailyDigests: (...a: unknown[]) => mocks.mockDispatchDailyDigests(...a),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...a: unknown[]) => mocks.mockAudit(...a),
}));

vi.mock("@/lib/auth/internalKey", () => ({
  checkInternalRouteKey: (...a: unknown[]) => mocks.mockCheckInternalKey(...a),
}));

vi.mock("@/lib/observability/errors", () => ({
  reportError: (...a: unknown[]) => mocks.mockReportError(...a),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: (...a: unknown[]) => mocks.mockLogInfo(...a),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: () => mocks.mockGetRequestId(),
}));

import { POST } from "@/app/api/internal/job-alerts/daily/route";

function makeRequest() {
  return new Request("http://localhost:3000/api/internal/job-alerts/daily", {
    method: "POST",
    headers: { "x-internal-key": "test-key-123" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockCheckInternalKey.mockResolvedValue({ ok: true });
  mocks.mockDispatchDailyDigests.mockResolvedValue({
    alertsProcessed: 2,
    alertsSkipped: 0,
    sent: 1,
    skippedNoEmail: 1,
    failed: 0,
    emailsSent: 1,
  });
  mocks.mockAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/internal/job-alerts/daily", () => {
  it("returns 401 when internal key is missing", async () => {
    mocks.mockCheckInternalKey.mockResolvedValue({
      ok: false,
      message: "Missing key",
      status: 401,
    });
    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Missing key");
  });

  it("dispatches daily digests and returns results", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alertsProcessed).toBe(2);
    expect(body.emailsSent).toBe(1);
    expect(body.sent).toBe(1);
    expect(body.skippedNoEmail).toBe(1);
  });

  it("writes an audit log on success", async () => {
    await POST(makeRequest());
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "JOB_ALERT_DIGEST_RUN" }),
    );
  });

  it("logs completion with metrics", async () => {
    await POST(makeRequest());
    expect(mocks.mockLogInfo).toHaveBeenCalledWith(
      "job_alerts_digest_completed",
      expect.objectContaining({
        alertsProcessed: 2,
        emailsSent: 1,
      }),
    );
  });

  it("returns 500 on dispatch failure", async () => {
    mocks.mockDispatchDailyDigests.mockRejectedValue(new Error("db down"));
    const response = await POST(makeRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("reports error on dispatch failure", async () => {
    mocks.mockDispatchDailyDigests.mockRejectedValue(new Error("db down"));
    await POST(makeRequest());
    expect(mocks.mockReportError).toHaveBeenCalledWith(
      "job_alerts_digest_failed",
      expect.any(Error),
      expect.objectContaining({ status: 500 }),
    );
  });

  it("handles zero alerts processed", async () => {
    mocks.mockDispatchDailyDigests.mockResolvedValue({
      alertsProcessed: 0,
      alertsSkipped: 0,
      sent: 0,
      skippedNoEmail: 0,
      failed: 0,
      emailsSent: 0,
    });
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.alertsProcessed).toBe(0);
    expect(body.emailsSent).toBe(0);
  });
});
