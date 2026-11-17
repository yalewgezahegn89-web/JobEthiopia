import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { eq, ne, or } from "drizzle-orm";
import { jobAlertDeliveries } from "@/db/schema/jobAlertDeliveries";

const mocks = vi.hoisted(() => {
  type DeliveryRecord = {
    alertId: string;
    jobId: string;
    status: string;
    sentAt: Date;
  };

  return {
    mockAlertFindMany: vi.fn(),
    mockAlertFindFirst: vi.fn(),
    mockUserFindFirst: vi.fn(),
    mockAlertUpdate: vi.fn(),
    mockClaimRows: vi.fn(() => [{ id: "claimed" }]),
    mockDeliveriesInsert: vi.fn(),
    mockConditionalUpsertGuard: vi.fn(),
    mockDeliveryStore: new Map<string, DeliveryRecord>(),
    mockDispatchEmail: vi.fn(),
    mockAudit: vi.fn(),
  };
});

function isFailedStatusUpsertGuard(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const chunks = (node as { queryChunks?: unknown }).queryChunks;
  if (!Array.isArray(chunks)) return false;

  const hasStatusColumn = chunks.some(
    (chunk) => (chunk as { name?: unknown }).name === "status",
  );
  const hasEqualsOperator = chunks.some((chunk) => {
    const value = (chunk as { value?: unknown }).value;
    return Array.isArray(value) && value.some((part) => String(part).trim() === "=");
  });
  const hasFailedParam = chunks.some(
    (chunk) => (chunk as { value?: unknown }).value === "FAILED",
  );

  return hasStatusColumn && hasEqualsOperator && hasFailedParam;
}

describe("delivery upsert guard detection", () => {
  it("accepts only equality on status to FAILED", () => {
    expect(
      isFailedStatusUpsertGuard(eq(jobAlertDeliveries.status, "FAILED")),
    ).toBe(true);
    expect(
      isFailedStatusUpsertGuard(ne(jobAlertDeliveries.status, "FAILED")),
    ).toBe(false);
    expect(
      isFailedStatusUpsertGuard(
        or(
          eq(jobAlertDeliveries.status, "FAILED"),
          eq(jobAlertDeliveries.status, "SENT"),
        ),
      ),
    ).toBe(false);
    expect(isFailedStatusUpsertGuard(undefined)).toBe(false);
  });
});

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
      values: (rows: Array<Record<string, unknown>>) => ({
        onConflictDoUpdate: (config: {
          set: { status: string; sentAt: Date };
          setWhere?: unknown;
        }) => {
          mocks.mockDeliveriesInsert(rows);
          // Mirror PostgreSQL `ON CONFLICT (alert_id, job_id) DO UPDATE`:
          // the unique key identifies the row, and the conditional update
          // only fires when the existing row is FAILED and the production
          // upsert supplied the expected status = FAILED predicate.
          const hasFailedStatusGuard = isFailedStatusUpsertGuard(config.setWhere);
          mocks.mockConditionalUpsertGuard(hasFailedStatusGuard);
          for (const row of rows) {
            const alertId = String(row.alertId);
            const jobId = String(row.jobId);
            const key = `${alertId}::${jobId}`;
            const existing = mocks.mockDeliveryStore.get(key);
            if (!existing) {
              mocks.mockDeliveryStore.set(key, {
                alertId,
                jobId,
                status: String(row.status),
                sentAt: row.sentAt instanceof Date ? row.sentAt : new Date(),
              });
            } else if (existing.status === "FAILED" && hasFailedStatusGuard) {
              mocks.mockDeliveryStore.set(key, {
                ...existing,
                status: config.set.status,
                sentAt: config.set.sentAt,
              });
            }
          }
          return { run: () => Promise.resolve() };
        },
      }),
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
  mocks.mockDeliveryStore.clear();
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
  function deliveryRecords() {
    return Array.from(mocks.mockDeliveryStore.values());
  }

  function seedDelivery(status: string, sentAt = new Date()) {
    mocks.mockDeliveryStore.set(`${alertRow().id}::job-1`, {
      alertId: alertRow().id,
      jobId: "job-1",
      status,
      sentAt,
    });
    return sentAt;
  }

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
    expect(deliveryRecords()).toEqual([
      expect.objectContaining({
        alertId: alertRow().id,
        jobId: "job-1",
        status: "SKIPPED_NO_EMAIL",
      }),
    ]);
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
    expect(deliveryRecords()).toEqual([
      expect.objectContaining({ jobId: "job-1", status: "SENT" }),
    ]);
  });

  it("records FAILED when the transport rejects", async () => {
    mocks.mockDispatchEmail.mockResolvedValue(false);
    const outcome = await deliverJobAlert(alertRow());
    expect(outcome.failed).toBe(1);
    expect(outcome.emailDelivered).toBe(false);
    expect(deliveryRecords()).toEqual([
      expect.objectContaining({ jobId: "job-1", status: "FAILED" }),
    ]);
  });

  it("updates the same FAILED delivery to SENT on a successful retry", async () => {
    mocks.mockDispatchEmail.mockResolvedValueOnce(false);
    await deliverJobAlert(alertRow());
    expect(deliveryRecords()[0]).toEqual(
      expect.objectContaining({ status: "FAILED" }),
    );

    mocks.mockDispatchEmail.mockResolvedValueOnce(true);
    await deliverJobAlert(alertRow());

    expect(deliveryRecords()).toEqual([
      expect.objectContaining({ jobId: "job-1", status: "SENT" }),
    ]);
  });

  it("keeps a FAILED delivery retryable and FAILED when the retry also fails", async () => {
    mocks.mockDispatchEmail.mockResolvedValue(false);
    await deliverJobAlert(alertRow());
    await deliverJobAlert(alertRow());

    expect(deliveryRecords()).toEqual([
      expect.objectContaining({ jobId: "job-1", status: "FAILED" }),
    ]);
  });

  it("does not regress an existing SENT delivery to FAILED", async () => {
    const sentAt = seedDelivery("SENT");
    mocks.mockDispatchEmail.mockResolvedValue(false);

    const outcome = await deliverJobAlert(alertRow());

    expect(outcome.failed).toBe(1);
    expect(mocks.mockConditionalUpsertGuard).toHaveBeenCalledWith(true);
    expect(deliveryRecords()).toHaveLength(1);
    expect(deliveryRecords()[0]).toEqual(
      expect.objectContaining({
        jobId: "job-1",
        status: "SENT",
        sentAt,
      }),
    );
  });

  it("does not regress an existing SKIPPED_NO_EMAIL delivery to FAILED", async () => {
    const sentAt = seedDelivery("SKIPPED_NO_EMAIL");
    mocks.mockDispatchEmail.mockResolvedValue(false);

    const outcome = await deliverJobAlert(alertRow());

    expect(outcome.failed).toBe(1);
    expect(mocks.mockConditionalUpsertGuard).toHaveBeenCalledWith(true);
    expect(deliveryRecords()).toHaveLength(1);
    expect(deliveryRecords()[0]).toEqual(
      expect.objectContaining({
        jobId: "job-1",
        status: "SKIPPED_NO_EMAIL",
        sentAt,
      }),
    );
  });

  it("does not create a duplicate delivery row on a successful retry", async () => {
    mocks.mockDispatchEmail.mockResolvedValueOnce(false);
    await deliverJobAlert(alertRow());
    mocks.mockDispatchEmail.mockResolvedValueOnce(true);
    await deliverJobAlert(alertRow());

    const records = deliveryRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        alertId: alertRow().id,
        jobId: "job-1",
        status: "SENT",
      }),
    );
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