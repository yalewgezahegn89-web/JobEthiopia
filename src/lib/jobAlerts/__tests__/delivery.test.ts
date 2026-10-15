import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  mockAlertFindMany: vi.fn(),
  mockAlertFindFirst: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockAlertUpdate: vi.fn(),
  mockClaimRows: vi.fn(() => [{ id: "claimed" }]),
  mockDeliveriesInsert: vi.fn(),
  mockDispatchEmail: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      jobAlerts: {
        findMany: (...a: unknown[]) => mocks.mockAlertFindMany(...a),
        findFirst: (...a: unknown[]) => mocks.mockAlertFindFirst(...a),
      },
      users: {
        findFirst: (...a: unknown[]) => mocks.mockUserFindFirst(...a),
      },
    },
    update: () => ({
      set: () => ({
        where: () => {
          mocks.mockAlertUpdate();
          return { returning: () => Promise.resolve(mocks.mockClaimRows()) };
        },
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        mocks.mockDeliveriesInsert(v);
        return { onConflictDoNothing: () => ({ run: () => Promise.resolve() }) };
      },
    }),
  },
}));

vi.mock("@/lib/email", () => ({
  dispatchJobAlertEmail: (...a: unknown[]) => mocks.mockDispatchEmail(...a),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...a: unknown[]) => mocks.mockAudit(...a),
}));

vi.mock("@/lib/auth/csrf", () => ({
  getAppBaseUrl: () => "https://app.example.com",
}));

import {
  hashUnsubscribeToken,
  createUnsubscribeToken,
  unsubscribeAlertWithToken,
  deliverJobAlert,
  dispatchDailyDigests,
  dispatchInstantAlertsForJob,
} from "@/lib/jobAlerts/delivery";
import type { JobAlertRow } from "@/lib/jobAlerts/dal";

function alertRow(overrides: Record<string, unknown> = {}): JobAlertRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "Auditor roles",
    keywords: "auditor",
    categoryId: null,
    professionId: null,
    locationId: null,
    employmentType: null,
    frequency: "DAILY",
    locale: "en",
    status: "ACTIVE",
    unsubscribeTokenHash: null,
    unsubscribeTokenExpiresAt: null,
    lastSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

vi.mock("@/lib/jobAlerts/matching", () => ({
  matchJobsForAlert: () =>
    Promise.resolve([
      {
        id: "job-1",
        title: "Senior Auditor",
        slug: "senior-auditor",
        organizationId: "org-1",
        organizationName: "BigCo",
        locationId: "loc-1",
        locationName: "Addis Ababa",
        employmentType: "FULL_TIME",
        description: null,
        postedAt: new Date(),
        deadline: null,
      },
    ]),
  splitAlertKeywords: () => ["auditor"],
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockUserFindFirst.mockResolvedValue({
    isActive: true,
    email: "candidate@example.com",
  });
  mocks.mockAlertFindMany.mockResolvedValue([]);
  mocks.mockAlertFindFirst.mockResolvedValue(undefined);
  mocks.mockDispatchEmail.mockResolvedValue(true);
  mocks.mockAudit.mockResolvedValue(undefined);
  mocks.mockClaimRows.mockReturnValue([{ id: "claimed" }]);
});

describe("tokens", () => {
  it("always hashes to a stable hex digest", () => {
    const raw = "some-raw-token";
    expect(hashUnsubscribeToken(raw)).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
  });

  it("rotates via update with a future expiry", async () => {
    const raw = await createUnsubscribeToken("alert-1");
    expect(raw.length).toBeGreaterThanOrEqual(43);
    expect(hashUnsubscribeToken(raw).length).toBe(64);
    expect(mocks.mockAlertUpdate).toHaveBeenCalledOnce();
  });
});

describe("unsubscribeAlertWithToken", () => {
  it("false for empty token", async () => {
    expect(await unsubscribeAlertWithToken("")).toBe(false);
  });

  it("false for unknown hash", async () => {
    mocks.mockAlertFindFirst.mockResolvedValue(undefined);
    expect(await unsubscribeAlertWithToken("nope")).toBe(false);
  });

  it("false for expired token", async () => {
    mocks.mockAlertFindFirst.mockResolvedValue(
      alertRow({ unsubscribeTokenExpiresAt: new Date(Date.now() - 1000) }),
    );
    expect(await unsubscribeAlertWithToken("expired")).toBe(false);
  });

  it("unsubscribes, revokes the token, and audits", async () => {
    mocks.mockAlertFindFirst.mockResolvedValue(
      alertRow({ unsubscribeTokenExpiresAt: new Date(Date.now() + 100_000) }),
    );
    const ok = await unsubscribeAlertWithToken("valid");
    expect(ok).toBe(true);
    expect(mocks.mockAlertUpdate).toHaveBeenCalledOnce();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "JOB_ALERT_UNSUBSCRIBED" }),
    );
  });
});

describe("deliverJobAlert", () => {
  it("records SKIPPED_NO_EMAIL when the user has no email", async () => {
    mocks.mockUserFindFirst.mockResolvedValue({ isActive: true, email: null });
    const outcome = await deliverJobAlert(alertRow());
    expect(outcome.skippedNoEmail).toBe(1);
    expect(outcome.emailDelivered).toBe(false);
    expect(mocks.mockDispatchEmail).not.toHaveBeenCalled();
    expect(mocks.mockDeliveriesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "SKIPPED_NO_EMAIL" }),
      ]),
    );
  });

  it("sends an email and records SENT when delivery succeeds", async () => {
    const outcome = await deliverJobAlert(alertRow());
    expect(outcome.emailDelivered).toBe(true);
    expect(outcome.delivered).toBe(1);
    expect(mocks.mockDispatchEmail).toHaveBeenCalledOnce();
    expect(mocks.mockDeliveriesInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: "SENT" }),
      ]),
    );
    expect(mocks.mockAlertUpdate).toHaveBeenCalled();
  });

  it("records FAILED when the transport rejects", async () => {
    mocks.mockDispatchEmail.mockResolvedValue(false);
    const outcome = await deliverJobAlert(alertRow());
    expect(outcome.failed).toBe(1);
    expect(outcome.emailDelivered).toBe(false);
  });
});

describe("dispatchDailyDigests", () => {
  it("returns empty result when no alerts are due", async () => {
    mocks.mockAlertFindMany.mockResolvedValue([]);
    const result = await dispatchDailyDigests();
    expect(result.alertsProcessed).toBe(0);
    expect(result.emailsSent).toBe(0);
  });

  it("processes due alerts even when the transport fails", async () => {
    mocks.mockAlertFindMany.mockResolvedValue([alertRow()]);
    mocks.mockDispatchEmail.mockResolvedValue(false);
    const result = await dispatchDailyDigests();
    expect(result.alertsProcessed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.emailsSent).toBe(0);
  });

  it("skips an alert that another run already claimed", async () => {
    mocks.mockAlertFindMany.mockResolvedValue([alertRow()]);
    mocks.mockClaimRows.mockReturnValue([]);
    const result = await dispatchDailyDigests();
    expect(result.alertsProcessed).toBe(1);
    expect(result.alertsSkipped).toBe(1);
    expect(result.emailsSent).toBe(0);
    expect(mocks.mockDispatchEmail).not.toHaveBeenCalled();
  });

  it("sends a digest and counts the delivery", async () => {
    mocks.mockAlertFindMany.mockResolvedValue([alertRow()]);
    const result = await dispatchDailyDigests();
    expect(result.alertsProcessed).toBe(1);
    expect(result.emailsSent).toBe(1);
    expect(result.sent).toBe(1);
    expect(mocks.mockDispatchEmail).toHaveBeenCalledOnce();
  });
});

describe("dispatchInstantAlertsForJob", () => {
  it("returns empty on any catastrophic failure without throwing", async () => {
    mocks.mockAlertFindMany.mockRejectedValue(new Error("db down"));
    const result = await dispatchInstantAlertsForJob("job-1");
    expect(result.alertsProcessed).toBe(0);
    expect(result.failed).toBe(0);
    expect(mocks.mockDispatchEmail).not.toHaveBeenCalled();
  });

  it("matches only the published job for INSTANT alerts", async () => {
    mocks.mockAlertFindMany.mockResolvedValue([
      alertRow({ id: "alert-2", frequency: "INSTANT" }),
    ]);
    const result = await dispatchInstantAlertsForJob("job-1");
    expect(result.alertsProcessed).toBe(1);
    expect(result.emailsSent).toBe(1);
  });
});