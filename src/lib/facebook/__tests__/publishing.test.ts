import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockJob: vi.fn(),
  mockOrganization: vi.fn(),
  mockLocation: vi.fn(),
  mockJobSources: vi.fn(),
  mockSources: vi.fn(),
  mockPublication: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockInsertValues: vi.fn(),
  mockUpdateReturning: vi.fn(),
  mockUpdateValues: vi.fn(),
  mockCreatePost: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      jobs: { findFirst: (...args: unknown[]) => mocks.mockJob(...args) },
      organizations: {
        findFirst: (...args: unknown[]) => mocks.mockOrganization(...args),
      },
      locations: {
        findFirst: (...args: unknown[]) => mocks.mockLocation(...args),
      },
      jobSources: { findMany: (...args: unknown[]) => mocks.mockJobSources(...args) },
      sources: { findMany: (...args: unknown[]) => mocks.mockSources(...args) },
      facebookPublications: {
        findFirst: (...args: unknown[]) => mocks.mockPublication(...args),
      },
    },
    insert: () => ({
      values: (values: unknown) => {
        mocks.mockInsertValues(values);
        return {
          onConflictDoNothing: () => ({
            returning: () => mocks.mockInsertReturning(),
          }),
        };
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        mocks.mockUpdateValues(values);
        return {
          where: () => ({
            returning: () => mocks.mockUpdateReturning(),
          }),
        };
      },
    }),
  },
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: (...args: unknown[]) => mocks.mockAudit(...args),
}));

vi.mock("../graphClient", () => ({
  createPageFeedPost: (...args: unknown[]) => mocks.mockCreatePost(...args),
}));

import {
  buildFacebookPostMessage,
  getFacebookPublicationForJob,
  getFacebookPublishPreview,
  publishJobToOwnedFacebookPage,
} from "../publishing";
import { OWNED_FACEBOOK_PAGE_ID } from "../config";

const ORIGINAL_ENV = { ...process.env };

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ACTOR = {
  id: ACTOR_ID,
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN" as const,
};

const JOB = {
  id: JOB_ID,
  title: "Senior Pilot",
  slug: "senior-pilot",
  description: "Fly aircraft safely and follow standard procedures.",
  status: "PUBLISHED",
  verificationStatus: "VERIFIED",
  applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
  deadline: new Date("2999-01-01T00:00:00.000Z"),
  applicationUrl: "https://www.ethiopianairlines.com/jobs/1",
  employmentType: "FULL_TIME",
  organizationId: "33333333-3333-4333-8333-333333333333",
  locationId: "44444444-4444-4444-8444-444444444444",
};

const ORGANIZATION = { name: "Ethiopian Airlines" };
const LOCATION = { name: "Addis Ababa" };
const SOURCE_ID = "55555555-5555-4555-8555-555555555555";
const WEBSITE_JOB_SOURCE_ROWS = [{ sourceId: SOURCE_ID }];
const WEBSITE_SOURCE_ROWS = [
  {
    id: SOURCE_ID,
    sourceType: "WEBSITE",
    facebookPageKind: null,
    facebookApprovalState: null,
    facebookContentUseState: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VERCEL_ENV = "production";
  process.env.ENABLE_FACEBOOK_PUBLISHING = "true";
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "test-page-token";
  delete process.env.APP_BASE_URL;

  mocks.mockJob.mockResolvedValue(JOB);
  mocks.mockOrganization.mockResolvedValue(ORGANIZATION);
  mocks.mockLocation.mockResolvedValue(LOCATION);
  mocks.mockJobSources.mockResolvedValue(WEBSITE_JOB_SOURCE_ROWS);
  mocks.mockSources.mockResolvedValue(WEBSITE_SOURCE_ROWS);
  mocks.mockPublication.mockResolvedValue(null);
  mocks.mockInsertReturning.mockResolvedValue([{ id: PUBLICATION_ID }]);
  mocks.mockUpdateReturning.mockResolvedValue([{ id: PUBLICATION_ID }]);
  mocks.mockAudit.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("buildFacebookPostMessage", () => {
  it("composes an original concise post from structured fields only", () => {
    const message = buildFacebookPostMessage({
      id: JOB_ID,
      title: "Senior Pilot",
      organizationName: "Ethiopian Airlines",
      locationName: "Addis Ababa",
      employmentType: "FULL_TIME",
      deadline: new Date("2999-01-01T00:00:00.000Z"),
      applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
    });

    expect(message).toContain("Senior Pilot");
    expect(message).toContain("Ethiopian Airlines");
    expect(message).toContain("Location: Addis Ababa");
    expect(message).toContain("Type: FULL TIME");
    expect(message).toContain("Eligibility: Ethiopian applicants confirmed");
    expect(message).toContain(`https://jobethiopia.et/jobs/${JOB_ID}`);
    // Structured fields only: the source description is never copied.
    expect(message).not.toContain("Fly aircraft safely");
  });
});

describe("publishJobToOwnedFacebookPage safety gates", () => {
  it.each([
    ["Preview", "preview"],
    ["development", "development"],
    ["an unknown Vercel environment", "staging"],
  ])("blocks live publishing in %s", async (_label, vercelEnv) => {
    process.env.VERCEL_ENV = vercelEnv;

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({
      published: false,
      reason: "LIVE_PUBLISHING_DISABLED",
    });
    expect(mocks.mockJob).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("fails closed when VERCEL_ENV is missing", async () => {
    delete process.env.VERCEL_ENV;

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({
      published: false,
      reason: "LIVE_PUBLISHING_DISABLED",
    });
    expect(mocks.mockJob).not.toHaveBeenCalled();
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("requires the dedicated ENABLE_FACEBOOK_PUBLISHING flag", async () => {
    delete process.env.ENABLE_FACEBOOK_PUBLISHING;
    process.env.ENABLE_FACEBOOK_INGESTION = "true";

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({
      published: false,
      reason: "FACEBOOK_PUBLISHING_DISABLED",
    });
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("requires the page access token", async () => {
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({ published: false, reason: "NOT_CONFIGURED" });
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("rejects a moderator (unauthorized administrator role)", async () => {
    const result = await publishJobToOwnedFacebookPage(
      { ...ACTOR, role: "MODERATOR" },
      JOB_ID,
      { contentRightsConfirmed: true },
    );

    expect(result).toEqual({ published: false, reason: "FORBIDDEN" });
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_FORBIDDEN",
        actorUserId: ACTOR_ID,
        targetId: JOB_ID,
      }),
    );
  });

  it("rejects an invalid or unknown job id", async () => {
    const result = await publishJobToOwnedFacebookPage(ACTOR, "not-a-uuid", {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({ published: false, reason: "NOT_FOUND" });
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("rejects a job that is not published and verified", async () => {
    mocks.mockJob.mockResolvedValue({ ...JOB, status: "DRAFT" });
    expect(
      (await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
        contentRightsConfirmed: true,
      })).reason,
    ).toBe("JOB_NOT_PUBLISHED_VERIFIED");

    mocks.mockJob.mockResolvedValue({ ...JOB, verificationStatus: "PENDING" });
    expect(
      (await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
        contentRightsConfirmed: true,
      })).reason,
    ).toBe("JOB_NOT_PUBLISHED_VERIFIED");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("rejects an expired vacancy", async () => {
    mocks.mockJob.mockResolvedValue({
      ...JOB,
      deadline: new Date("2000-01-01T00:00:00.000Z"),
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DEADLINE_EXPIRED");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed applicant eligibility", async () => {
    mocks.mockJob.mockResolvedValue({
      ...JOB,
      applicantEligibility: "NOT_STATED",
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("ELIGIBILITY_NOT_CONFIRMED");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("requires the explicit content-rights confirmation", async () => {
    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: false,
    });

    expect(result).toEqual({
      published: false,
      reason: "CONTENT_AUTHORIZATION_REQUIRED",
    });
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_RIGHTS_UNCONFIRMED",
      }),
    );
  });

  it("uses the canonical public job URL even when APP_BASE_URL is a Preview URL", async () => {
    process.env.APP_BASE_URL =
      "https://jobethiopia-git-feature-example.vercel.app";
    mocks.mockCreatePost.mockResolvedValue({ ok: true, postId: "999" });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.published).toBe(true);
    expect(mocks.mockCreatePost).toHaveBeenCalledWith(
      OWNED_FACEBOOK_PAGE_ID,
      "test-page-token",
      expect.objectContaining({
        link: `https://jobethiopia.et/jobs/${JOB_ID}`,
        message: expect.stringContaining(
          `https://jobethiopia.et/jobs/${JOB_ID}`,
        ),
      }),
    );
  });

  it("rejects an unsafe application URL", async () => {
    mocks.mockJob.mockResolvedValue({
      ...JOB,
      applicationUrl: "javascript:alert(1)",
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("UNSAFE_URL");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("rejects a job without provenance", async () => {
    mocks.mockJobSources.mockResolvedValue([]);

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("NO_PROVENANCE");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("requires Meta approval and content-use authorization for external Facebook sources", async () => {
    mocks.mockSources.mockResolvedValue([
      {
        id: SOURCE_ID,
        sourceType: "FACEBOOK",
        facebookPageKind: "EXTERNAL_PAGE",
        facebookApprovalState: "PENDING",
        facebookContentUseState: "AUTHORIZED",
      },
    ]);
    expect(
      (await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
        contentRightsConfirmed: true,
      })).reason,
    ).toBe("FACEBOOK_APPROVAL_REQUIRED");

    mocks.mockSources.mockResolvedValue([
      {
        id: SOURCE_ID,
        sourceType: "FACEBOOK",
        facebookPageKind: "EXTERNAL_PAGE",
        facebookApprovalState: "APPROVED",
        facebookContentUseState: "PENDING",
      },
    ]);
    expect(
      (await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
        contentRightsConfirmed: true,
      })).reason,
    ).toBe("FACEBOOK_CONTENT_USE_NOT_AUTHORIZED");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockInsertValues).not.toHaveBeenCalled();
  });

  it("allows an approved and authorized external Facebook source", async () => {
    mocks.mockSources.mockResolvedValue([
      {
        id: SOURCE_ID,
        sourceType: "FACEBOOK",
        facebookPageKind: "EXTERNAL_PAGE",
        facebookApprovalState: "APPROVED",
        facebookContentUseState: "AUTHORIZED",
      },
    ]);
    mocks.mockCreatePost.mockResolvedValue({ ok: true, postId: "999" });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.published).toBe(true);
  });
});

describe("duplicate protection and claiming", () => {
  it("claims the publication record before calling Meta", async () => {
    mocks.mockCreatePost.mockResolvedValue({ ok: true, postId: "999" });

    await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(mocks.mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB_ID,
        pageId: OWNED_FACEBOOK_PAGE_ID,
        state: "PENDING",
        requestedBy: ACTOR_ID,
      }),
    );
    expect(
      mocks.mockInsertValues.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.mockCreatePost.mock.invocationCallOrder[0]);
  });

  it("blocks a second concurrent request for the same job (PENDING)", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue({
      id: PUBLICATION_ID,
      state: "PENDING",
      facebookPostId: null,
      lastError: null,
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DUPLICATE_IN_PROGRESS");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_DUPLICATE_REJECTED",
      }),
    );
  });

  it("blocks a job that is already published to the Page", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue({
      id: PUBLICATION_ID,
      state: "PUBLISHED",
      facebookPostId: "999",
      lastError: null,
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DUPLICATE_ALREADY_PUBLISHED");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });

  it("never re-attempts a job whose previous outcome is UNKNOWN", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue({
      id: PUBLICATION_ID,
      state: "UNKNOWN",
      facebookPostId: null,
      lastError: "Request timed out",
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DUPLICATE_UNKNOWN_OUTCOME");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockUpdateValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: "PENDING" }),
    );
  });

  it("re-claims a FAILED record for one new explicit request", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue({
      id: PUBLICATION_ID,
      state: "FAILED",
      facebookPostId: null,
      lastError: "Graph API rejected the post",
    });
    mocks.mockUpdateReturning.mockResolvedValue([{ id: PUBLICATION_ID }]);
    mocks.mockCreatePost.mockResolvedValue({ ok: true, postId: "999" });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.published).toBe(true);
    expect(mocks.mockUpdateValues).toHaveBeenCalledWith(
      expect.objectContaining({ state: "PENDING", requestedBy: ACTOR_ID }),
    );
    expect(mocks.mockCreatePost).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the conflicting publication row vanished", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue(null);

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DUPLICATE_IN_PROGRESS");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_DUPLICATE_REJECTED",
      }),
    );
  });

  it("loses the reclaim race when another administrator wins the FAILED row", async () => {
    mocks.mockInsertReturning.mockResolvedValue([]);
    mocks.mockPublication.mockResolvedValue({
      id: PUBLICATION_ID,
      state: "FAILED",
      facebookPostId: null,
      lastError: null,
    });
    mocks.mockUpdateReturning.mockResolvedValue([]);

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("DUPLICATE_IN_PROGRESS");
    expect(mocks.mockCreatePost).not.toHaveBeenCalled();
  });
});

describe("publish outcomes", () => {
  it("records PUBLISHED with the remote post id and audits the success", async () => {
    mocks.mockCreatePost.mockResolvedValue({ ok: true, postId: "999" });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result).toEqual({
      published: true,
      reason: "PUBLISHED",
      postId: "999",
    });
    expect(mocks.mockCreatePost).toHaveBeenCalledWith(
      OWNED_FACEBOOK_PAGE_ID,
      "test-page-token",
      expect.objectContaining({
        message: expect.stringContaining("Senior Pilot"),
        link: expect.stringContaining(`/jobs/${JOB_ID}`),
      }),
    );
    expect(mocks.mockUpdateValues).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "PUBLISHED",
        facebookPostId: "999",
        lastError: null,
      }),
    );
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISHED",
        actorUserId: ACTOR_ID,
        targetType: "job",
        targetId: JOB_ID,
        metadata: expect.objectContaining({
          pageId: OWNED_FACEBOOK_PAGE_ID,
          facebookPostId: "999",
          contentRightsConfirmed: true,
        }),
      }),
    );
  });

  it.each([500, 502, 504, 408])(
    "maps an ambiguous HTTP %i outcome to UNKNOWN without retrying",
    async (status) => {
      mocks.mockCreatePost.mockResolvedValue({
        ok: false,
        error: `Graph API rejected the post (HTTP ${status})`,
        ambiguous: true,
      });

      const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
        contentRightsConfirmed: true,
      });

      expect(result.published).toBe(false);
      expect(result.reason).toBe("UNKNOWN_OUTCOME");
      expect(mocks.mockCreatePost).toHaveBeenCalledTimes(1);
      expect(mocks.mockUpdateValues).toHaveBeenLastCalledWith(
        expect.objectContaining({ state: "UNKNOWN" }),
      );
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "JOB_FACEBOOK_PUBLISH_UNKNOWN",
          actorUserId: ACTOR_ID,
          metadata: expect.objectContaining({
            contentRightsConfirmed: true,
          }),
        }),
      );
    },
  );

  it("marks an ambiguous outcome UNKNOWN and audits it", async () => {
    mocks.mockCreatePost.mockResolvedValue({
      ok: false,
      error: "Request timed out",
      ambiguous: true,
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.published).toBe(false);
    expect(result.reason).toBe("UNKNOWN_OUTCOME");
    expect(result.error).toBe("Request timed out");
    expect(mocks.mockUpdateValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "UNKNOWN" }),
    );
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_UNKNOWN",
        metadata: expect.objectContaining({ error: "Request timed out" }),
      }),
    );
  });

  it("marks a definite rejection FAILED", async () => {
    mocks.mockCreatePost.mockResolvedValue({
      ok: false,
      error: "Permissions error",
      ambiguous: false,
    });

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.published).toBe(false);
    expect(result.reason).toBe("GRAPH_REJECTED");
    expect(mocks.mockUpdateValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "FAILED" }),
    );
    expect(mocks.mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "JOB_FACEBOOK_PUBLISH_FAILED",
        actorUserId: ACTOR_ID,
        metadata: expect.objectContaining({
          contentRightsConfirmed: true,
        }),
      }),
    );
  });

  it("treats an unexpected thrown error as an ambiguous UNKNOWN outcome", async () => {
    mocks.mockCreatePost.mockRejectedValue(new Error("local explosion"));

    const result = await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    expect(result.reason).toBe("UNKNOWN_OUTCOME");
    expect(mocks.mockUpdateValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: "UNKNOWN" }),
    );
  });

  it("never writes the access token to audit metadata or stored errors", async () => {
    mocks.mockCreatePost.mockResolvedValue({
      ok: false,
      error: "Graph error containing access_token=super-secret-value",
      ambiguous: false,
    });

    await publishJobToOwnedFacebookPage(ACTOR, JOB_ID, {
      contentRightsConfirmed: true,
    });

    const auditJson = JSON.stringify(mocks.mockAudit.mock.calls);
    const recordJson = JSON.stringify(mocks.mockUpdateValues.mock.calls);
    expect(auditJson).not.toContain("test-page-token");
    expect(recordJson).not.toContain("test-page-token");
  });
});

describe("preview and publication lookups", () => {
  it("loads the preview from structured job fields", async () => {
    mocks.mockJob.mockResolvedValue({
      id: JOB_ID,
      title: "Senior Pilot",
      status: "PUBLISHED",
      verificationStatus: "VERIFIED",
      deadline: new Date("2999-01-01T00:00:00.000Z"),
      applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
      employmentType: "FULL_TIME",
      organizationId: JOB.organizationId,
      locationId: JOB.locationId,
    });

    const preview = await getFacebookPublishPreview(JOB_ID);

    expect(preview).not.toBeNull();
    expect(preview?.message).toContain("Senior Pilot");
    expect(preview?.message).toContain("Ethiopian Airlines");
    expect(preview?.link).toBe(`https://jobethiopia.et/jobs/${JOB_ID}`);
    expect(preview?.deadlineExpired).toBe(false);
    expect(preview?.eligibilityConfirmed).toBe(true);
  });

  it("returns null for a missing job", async () => {
    mocks.mockJob.mockResolvedValue(undefined);
    expect(await getFacebookPublishPreview(JOB_ID)).toBeNull();
  });

  it("scopes the publication lookup to the owned Page", async () => {
    mocks.mockPublication.mockResolvedValue({ id: PUBLICATION_ID, state: "PUBLISHED" });

    const record = await getFacebookPublicationForJob(JOB_ID);

    expect(record).toEqual({ id: PUBLICATION_ID, state: "PUBLISHED" });
    expect(mocks.mockPublication).toHaveBeenCalledTimes(1);
  });
});
