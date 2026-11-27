import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { sources } from "@/db/schema/sources";
import { telegramPublications } from "@/db/schema/telegramPublications";
import { validateJobForPublish } from "@/lib/admin/jobs";
import { writeAuditLog } from "@/lib/auth/audit";
import { isDeadlineExpired } from "@/lib/jobs/applicantEligibility";
import {
  getAdapterForSourceRecord,
} from "@/lib/sources/adapters";
import { getTelegramChannelId } from "@/lib/telegram/config";
import { isFacebookIngestionEnabled } from "@/lib/facebook/config";

export type AutoPublishReason =
  | "PUBLISHED"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_INACTIVE"
  | "AUTO_PUBLISH_DISABLED"
  | "UNTRUSTED_SOURCE"
  | "UNSUPPORTED_SOURCE_TYPE"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_DRAFT"
  | "ELIGIBILITY_NOT_CONFIRMED"
  | "DEADLINE_EXPIRED"
  | "UNSAFE_URL"
  | "VALIDATION_FAILED"
  | "TELEGRAM_NOT_CONFIGURED"
  | "FACEBOOK_DISABLED"
  | "FACEBOOK_APPROVAL_REQUIRED"
  | "FACEBOOK_CONTENT_USE_NOT_AUTHORIZED"
  | "RACE_LOST";

export interface AutoPublishResult {
  published: boolean;
  reason: AutoPublishReason;
  validationCode?: string;
  telegramChannel?: string;
}

const AUTO_PUBLISHABLE_ELIGIBILITY = new Set([
  "ETHIOPIAN_APPLICANTS_CONFIRMED",
  "INTERNATIONAL_APPLICANTS_ACCEPTED",
]);

function isSafeHttpUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Publishes a freshly ingested job and enqueues exactly one Telegram outbox
 * row, inside a single transaction.
 *
 * Safety gates (all required):
 * - source exists, is active, and explicitly opted in with `autoPublish`,
 * - source trust level is HIGH and its type has an automated adapter,
 * - job is still DRAFT (only newly created imports are considered),
 * - applicant eligibility is explicitly confirmed (never inferred),
 * - deadline is not in the past,
 * - application/source URLs are http(s),
 * - the standard publication validation gate passes (complete data,
 *   active organization/category/location, provenance),
 * - Facebook sources are enabled and, for external Pages, have both Meta
 *   approval and documented content-use authorization,
 * - a Telegram channel is configured (optional; website publication does not
 *   depend on Telegram).
 *
 * A conditional `status = DRAFT` update prevents two workers from publishing
 * the same job; the unique `(jobId, channel)` index prevents duplicate posts.
 */
export async function autoPublishIngestedJob(
  jobId: string,
  sourceId: string,
): Promise<AutoPublishResult> {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: {
      id: true,
      name: true,
      sourceType: true,
      baseUrl: true,
      isActive: true,
      autoPublish: true,
      trustLevel: true,
      facebookPageKind: true,
      facebookApprovalState: true,
      facebookContentUseState: true,
    },
  });

  if (!source) return { published: false, reason: "SOURCE_NOT_FOUND" };
  if (!source.isActive) return { published: false, reason: "SOURCE_INACTIVE" };
  if (!source.autoPublish) {
    return { published: false, reason: "AUTO_PUBLISH_DISABLED" };
  }
  if (source.trustLevel !== "HIGH") {
    return { published: false, reason: "UNTRUSTED_SOURCE" };
  }
  if (!getAdapterForSourceRecord(source)) {
    return { published: false, reason: "UNSUPPORTED_SOURCE_TYPE" };
  }

  if (source.sourceType === "FACEBOOK") {
    if (!isFacebookIngestionEnabled()) {
      return { published: false, reason: "FACEBOOK_DISABLED" };
    }
    const isExternal =
      (source.facebookPageKind ?? "EXTERNAL_PAGE") === "EXTERNAL_PAGE";
    if (isExternal && source.facebookApprovalState !== "APPROVED") {
      return { published: false, reason: "FACEBOOK_APPROVAL_REQUIRED" };
    }
    if (isExternal && source.facebookContentUseState !== "AUTHORIZED") {
      return {
        published: false,
        reason: "FACEBOOK_CONTENT_USE_NOT_AUTHORIZED",
      };
    }
  }

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });
  if (!job) return { published: false, reason: "JOB_NOT_FOUND" };
  if (job.status !== "DRAFT") {
    return { published: false, reason: "JOB_NOT_DRAFT" };
  }
  if (!AUTO_PUBLISHABLE_ELIGIBILITY.has(job.applicantEligibility)) {
    return { published: false, reason: "ELIGIBILITY_NOT_CONFIRMED" };
  }
  if (isDeadlineExpired(job.deadline)) {
    return { published: false, reason: "DEADLINE_EXPIRED" };
  }
  if (!isSafeHttpUrl(job.applicationUrl)) {
    return { published: false, reason: "UNSAFE_URL" };
  }

  const validation = await validateJobForPublish(job);
  if (!validation.ok) {
    return {
      published: false,
      reason: "VALIDATION_FAILED",
      validationCode: validation.code,
    };
  }

  const channel = getTelegramChannelId();

  const now = new Date();
  const outcome = await db.transaction(async (tx) => {
    const updated = await tx
      .update(jobs)
      .set({
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "DRAFT")))
      .returning({ id: jobs.id });

    if (updated.length === 0) return "RACE_LOST" as const;

    if (channel) {
      await tx
        .insert(telegramPublications)
        .values({
          jobId,
          channel,
          state: "QUEUED",
          attempts: 0,
          nextRetryAt: now,
        })
        .onConflictDoNothing();
    }

    return "PUBLISHED" as const;
  });

  if (outcome === "RACE_LOST") {
    return { published: false, reason: "RACE_LOST" };
  }

  await writeAuditLog({
    actorUserId: null,
    action: "JOB_AUTO_PUBLISHED",
    targetType: "job",
    targetId: jobId,
    metadata: {
      source: "automated_ingestion",
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.sourceType,
      applicantEligibility: job.applicantEligibility,
      telegramChannel: channel ?? null,
    },
  });

  return {
    published: true,
    reason: "PUBLISHED",
    ...(channel ? { telegramChannel: channel } : {}),
  };
}
