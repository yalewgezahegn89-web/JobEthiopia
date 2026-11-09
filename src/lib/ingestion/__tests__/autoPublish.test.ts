import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSource: vi.fn(),
  mockJob: vi.fn(),
  mockTransaction: vi.fn(),
  mockValidate: vi.fn(),
  mockAudit: vi.fn(),
  mockChannel: vi.fn(),
  mockAdapter: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockInsertValues: vi.fn(),
  mockOnConflict: vi.fn(),
  mockFacebookEnabled: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mocks.mockSource(...args),
      },
      jobs: {
        findFirst: (...args: unknown[]) => mocks.mockJob(...args),
      },
    },
    transaction: (...args: unknown[]) => mocks.mockTransaction(...args),
  },
}));

vi.mock("@/lib/admin/jobs", () => ({
  validateJobForPublish: (...args: unknown[]) => mocks.mockValidate(...args),
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mocks.mockAudit(...args),
}));

vi.mock("@/lib/sources/adapters", () => ({
  getAdapterForSourceRecord: (...args: unknown[]) => mocks.mockAdapter(...args),
}));

vi.mock("@/lib/telegram/config", () => ({
  getTelegramChannelId: () => mocks.mockChannel(),
}));

vi.mock("@/lib/facebook/config", () => ({
  isFacebookIngestionEnabled: () => mocks.mockFacebookEnabled(),
}));

import { autoPublishIngestedJob } from "../autoPublish";

const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "11111111-1111-4111-8111-111111111111";

const SOURCE = {
  id: SOURCE_ID,
  name: "Ethiopian Airlines",
  sourceType: "WEBSITE",
  baseUrl: "https://www.ethiopianairlines.com/careers",
  isActive: true,
  autoPublish: true,
  trustLevel: "HIGH",
};

const JOB = {
  id: JOB_ID,
  status: "DRAFT",
  applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
  deadline: new Date("2999-01-01T00:00:00.000Z"),
  applicationUrl: "https://www.ethiopianairlines.com/jobs/1",
};

function transactionTx() {
  return {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => mocks.mockUpdateReturning(),
        }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        mocks.mockInsertValues(values);
        return {
          onConflictDoNothing: () => mocks.mockOnConflict(),
        };
      },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockSource.mockResolvedValue(SOURCE);
  mocks.mockJob.mockResolvedValue(JOB);
  mocks.mockAdapter.mockReturnValue({ fetchJobs: vi.fn() });
  mocks.mockValidate.mockResolvedValue({ ok: true });
  mocks.mockChannel.mockReturnValue("@jobs");
  mocks.mockFacebookEnabled.mockReturnValue(true);
  mocks.mockUpdateReturning.mockResolvedValue([{ id: JOB_ID }]);
  mocks.mockOnConflict.mockResolvedValue(undefined);
  mocks.mockAudit.mockResolvedValue(undefined);
  mocks.mockTransaction.mockImplementation(
    (callback: (tx: unknown) => unknown) => callback(transactionTx()),
  );
});

describe("autoPublishIngestedJob safety gates", () => {
  it("rejects a missing, inactive or unopted-in source", async () => {
    mocks.mockSource.mockResolvedValue(undefined);
    expect(await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).toEqual({
      published: false,
      reason: "SOURCE_NOT_FOUND",
    });

    mocks.mockSource.mockResolvedValue({ ...SOURCE, isActive: false });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "SOURCE_INACTIVE",
    );

    mocks.mockSource.mockResolvedValue({ ...SOURCE, autoPublish: false });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "AUTO_PUBLISH_DISABLED",
    );
  });

  it("requires HIGH trust and a supported adapter", async () => {
    mocks.mockSource.mockResolvedValue({ ...SOURCE, trustLevel: "MEDIUM" });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "UNTRUSTED_SOURCE",
    );

    mocks.mockSource.mockResolvedValue(SOURCE);
    mocks.mockAdapter.mockReturnValue(null);
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "UNSUPPORTED_SOURCE_TYPE",
    );
  });

  it("requires a DRAFT job with confirmed eligibility and a valid URL", async () => {
    mocks.mockJob.mockResolvedValue(undefined);
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "JOB_NOT_FOUND",
    );

    mocks.mockJob.mockResolvedValue({ ...JOB, status: "PUBLISHED" });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "JOB_NOT_DRAFT",
    );

    mocks.mockJob.mockResolvedValue({
      ...JOB,
      applicantEligibility: "NOT_STATED",
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "ELIGIBILITY_NOT_CONFIRMED",
    );

    mocks.mockJob.mockResolvedValue({
      ...JOB,
      deadline: new Date("2000-01-01T00:00:00.000Z"),
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "DEADLINE_EXPIRED",
    );

    mocks.mockJob.mockResolvedValue({
      ...JOB,
      applicationUrl: "javascript:alert(1)",
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "UNSAFE_URL",
    );
  });

  it("stops before publishing when validation fails", async () => {
    mocks.mockValidate.mockResolvedValue({ ok: false, code: "INCOMPLETE" });
    expect(await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).toEqual({
      published: false,
      reason: "VALIDATION_FAILED",
      validationCode: "INCOMPLETE",
    });
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("publishes the website job when Telegram is not configured", async () => {
    mocks.mockChannel.mockReturnValue(null);

    const result = await autoPublishIngestedJob(JOB_ID, SOURCE_ID);

    expect(result).toEqual({ published: true, reason: "PUBLISHED" });
    expect(mocks.mockTransaction).toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_AUTO_PUBLISHED",
        metadata: expect.objectContaining({ telegramChannel: null }),
      }),
    );
  });

  it("blocks Facebook sources while the feature flag is disabled", async () => {
    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      sourceType: "FACEBOOK",
      facebookPageKind: "OWNED_PAGE",
    });
    mocks.mockFacebookEnabled.mockReturnValue(false);

    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "FACEBOOK_DISABLED",
    );
    expect(mocks.mockTransaction).not.toHaveBeenCalled();
  });

  it("requires Meta approval and content-use authorization for external Pages", async () => {
    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      sourceType: "FACEBOOK",
      facebookPageKind: "EXTERNAL_PAGE",
      facebookApprovalState: "PENDING",
      facebookContentUseState: "AUTHORIZED",
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "FACEBOOK_APPROVAL_REQUIRED",
    );

    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      sourceType: "FACEBOOK",
      facebookPageKind: "EXTERNAL_PAGE",
      facebookApprovalState: "APPROVED",
      facebookContentUseState: "PENDING",
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).reason).toBe(
      "FACEBOOK_CONTENT_USE_NOT_AUTHORIZED",
    );

    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      sourceType: "FACEBOOK",
      facebookPageKind: "EXTERNAL_PAGE",
      facebookApprovalState: "APPROVED",
      facebookContentUseState: "AUTHORIZED",
    });
    expect((await autoPublishIngestedJob(JOB_ID, SOURCE_ID)).published).toBe(
      true,
    );
  });

  it("publishes and enqueues exactly one Telegram outbox row", async () => {
    const result = await autoPublishIngestedJob(JOB_ID, SOURCE_ID);

    expect(result).toEqual({
      published: true,
      reason: "PUBLISHED",
      telegramChannel: "@jobs",
    });
    expect(mocks.mockInsertValues).toHaveBeenCalledWith({
      jobId: JOB_ID,
      channel: "@jobs",
      state: "QUEUED",
      attempts: 0,
      nextRetryAt: expect.any(Date),
    });
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_AUTO_PUBLISHED",
        targetType: "job",
        targetId: JOB_ID,
      }),
    );
  });

  it("reports RACE_LOST without enqueuing when the DRAFT guard fails", async () => {
    mocks.mockUpdateReturning.mockResolvedValue([]);

    const result = await autoPublishIngestedJob(JOB_ID, SOURCE_ID);

    expect(result).toEqual({ published: false, reason: "RACE_LOST" });
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    expect(mocks.mockAudit).not.toHaveBeenCalled();
  });
});
