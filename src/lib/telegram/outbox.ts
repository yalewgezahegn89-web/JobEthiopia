import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { locations } from "@/db/schema/locations";
import { organizations } from "@/db/schema/organizations";
import { telegramPublications } from "@/db/schema/telegramPublications";
import { writeAuditLog } from "@/lib/auth/audit";
import { logWarn } from "@/lib/observability/logger";
import { getTelegramBotConfig } from "./config";
import { sendTelegramMessage } from "./client";
import {
  buildTelegramPublicationText,
  renderTelegramMessage,
} from "./templates";
import type { TelegramBotConfig } from "./config";

export const TELEGRAM_OUTBOX_BATCH_SIZE = 20;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export interface TelegramOutboxResult {
  configured: boolean;
  reason: string | null;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

interface ClaimedPublication {
  id: string;
  jobId: string;
  channel: string;
  attempts: number;
  maxAttempts: number;
}

interface PublicationJob {
  id: string;
  title: string;
  description: string;
  status: string;
  employmentType: string | null;
  deadline: Date | null;
  applicantEligibility:
    | "ETHIOPIAN_APPLICANTS_CONFIRMED"
    | "INTERNATIONAL_APPLICANTS_ACCEPTED"
    | "LOCAL_WORK_AUTHORIZATION_REQUIRED"
    | "CITIZENSHIP_RESTRICTED"
    | "NOT_STATED";
  organizationName: string | null;
  locationName: string | null;
}

async function claimDuePublications(
  limit: number,
  now: Date,
): Promise<ClaimedPublication[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({
        id: telegramPublications.id,
        jobId: telegramPublications.jobId,
        channel: telegramPublications.channel,
        attempts: telegramPublications.attempts,
        maxAttempts: telegramPublications.maxAttempts,
      })
      .from(telegramPublications)
      .where(
        and(
          inArray(telegramPublications.state, ["QUEUED", "RETRY"]),
          lte(telegramPublications.nextRetryAt, now),
        ),
      )
      .orderBy(
        asc(telegramPublications.nextRetryAt),
        asc(telegramPublications.createdAt),
      )
      .limit(limit)
      .for("update", { skipLocked: true });

    if (due.length === 0) return [];

    await tx
      .update(telegramPublications)
      .set({ state: "SENDING", updatedAt: now })
      .where(
        inArray(
          telegramPublications.id,
          due.map((row) => row.id),
        ),
      );

    return due;
  });
}

async function loadPublicationJob(
  jobId: string,
): Promise<PublicationJob | null> {
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      description: jobs.description,
      status: jobs.status,
      employmentType: jobs.employmentType,
      deadline: jobs.deadline,
      applicantEligibility: jobs.applicantEligibility,
      organizationName: organizations.name,
      locationName: locations.name,
    })
    .from(jobs)
    .leftJoin(organizations, eq(jobs.organizationId, organizations.id))
    .leftJoin(locations, eq(jobs.locationId, locations.id))
    .where(eq(jobs.id, jobId))
    .limit(1);

  return rows[0] ?? null;
}

function retryDelayMs(attempts: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  const exponential = BASE_BACKOFF_MS * 2 ** Math.max(attempts, 0);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

async function markSkipped(
  publication: ClaimedPublication,
  reason: string,
  now: Date,
): Promise<void> {
  await db
    .update(telegramPublications)
    .set({
      state: "SKIPPED",
      lastError: reason,
      nextRetryAt: null,
      updatedAt: now,
    })
    .where(eq(telegramPublications.id, publication.id));

  await writeAuditLog({
    actorUserId: null,
    action: "TELEGRAM_PUBLICATION_SKIPPED",
    targetType: "job",
    targetId: publication.jobId,
    metadata: {
      publicationId: publication.id,
      channel: publication.channel,
      reason,
    },
  });
}

async function deliver(
  publication: ClaimedPublication,
  config: TelegramBotConfig,
  now: Date,
): Promise<"SENT" | "RETRY" | "FAILED" | "SKIPPED"> {
  if (publication.channel !== config.channelId) {
    await markSkipped(publication, "Channel is no longer configured", now);
    return "SKIPPED";
  }

  const job = await loadPublicationJob(publication.jobId);
  if (!job) {
    await markSkipped(publication, "Job no longer exists", now);
    return "SKIPPED";
  }
  if (job.status !== "PUBLISHED") {
    await markSkipped(publication, "Job is no longer published", now);
    return "SKIPPED";
  }

  const sourceText = buildTelegramPublicationText({
    id: job.id,
    title: job.title,
    description: job.description,
    organizationName: job.organizationName ?? "JobEthiopia",
    locationName: job.locationName,
    employmentType: job.employmentType,
    deadline: job.deadline,
    applicantEligibility: job.applicantEligibility,
  });
  const message = renderTelegramMessage(sourceText);

  const result = await sendTelegramMessage(config, message);
  const attempts = publication.attempts + 1;

  if (result.ok) {
    await db
      .update(telegramPublications)
      .set({
        state: "SENT",
        attempts,
        telegramMessageId: result.messageId,
        lastError: null,
        nextRetryAt: null,
        sentAt: now,
        updatedAt: now,
      })
      .where(eq(telegramPublications.id, publication.id));

    await writeAuditLog({
      actorUserId: null,
      action: "TELEGRAM_PUBLICATION_SENT",
      targetType: "job",
      targetId: publication.jobId,
      metadata: {
        publicationId: publication.id,
        channel: publication.channel,
        attempts,
        telegramMessageId: result.messageId,
      },
    });
    return "SENT";
  }

  const exhausted = attempts >= publication.maxAttempts;
  if (!result.retryable || exhausted) {
    await db
      .update(telegramPublications)
      .set({
        state: "FAILED",
        attempts,
        lastError: result.error,
        nextRetryAt: null,
        updatedAt: now,
      })
      .where(eq(telegramPublications.id, publication.id));

    await writeAuditLog({
      actorUserId: null,
      action: "TELEGRAM_PUBLICATION_FAILED",
      targetType: "job",
      targetId: publication.jobId,
      metadata: {
        publicationId: publication.id,
        channel: publication.channel,
        attempts,
        error: result.error,
      },
    });
    return "FAILED";
  }

  const nextRetryAt = new Date(
    now.getTime() +
      retryDelayMs(publication.attempts, result.retryAfterSeconds),
  );

  await db
    .update(telegramPublications)
    .set({
      state: "RETRY",
      attempts,
      lastError: result.error,
      nextRetryAt,
      updatedAt: now,
    })
    .where(eq(telegramPublications.id, publication.id));

  logWarn("telegram_publication_retry_scheduled", {
    publicationId: publication.id,
    jobId: publication.jobId,
    attempts,
    nextRetryAt: nextRetryAt.toISOString(),
    error: result.error,
  });

  return "RETRY";
}

/**
 * Drains due Telegram outbox rows.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED`, so concurrent workers never process
 * the same row. Terminal outcomes are audited; retryable failures are
 * rescheduled with exponential backoff (honouring Telegram `retry_after`).
 * A missing bot configuration leaves every queued row untouched.
 */
export async function processTelegramOutbox(
  limit: number = TELEGRAM_OUTBOX_BATCH_SIZE,
): Promise<TelegramOutboxResult> {
  const configResult = getTelegramBotConfig();
  if (!configResult.ok) {
    return {
      configured: false,
      reason: configResult.reason,
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const result: TelegramOutboxResult = {
    configured: true,
    reason: null,
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  const now = new Date();
  const claimed = await claimDuePublications(
    Math.max(1, Math.min(limit, TELEGRAM_OUTBOX_BATCH_SIZE)),
    now,
  );
  result.claimed = claimed.length;

  for (const publication of claimed) {
    try {
      const outcome = await deliver(publication, configResult.config, now);
      if (outcome === "SENT") result.sent += 1;
      else if (outcome === "RETRY") result.retried += 1;
      else if (outcome === "FAILED") result.failed += 1;
      else result.skipped += 1;
    } catch (err: unknown) {
      // A worker crash must not leave the row stuck in SENDING.
      const message = err instanceof Error ? err.message : "Delivery failed";
      logWarn("telegram_publication_delivery_crashed", {
        publicationId: publication.id,
        jobId: publication.jobId,
        error: message,
      });
      await db
        .update(telegramPublications)
        .set({
          state: "RETRY",
          attempts: publication.attempts + 1,
          lastError: "Delivery failed",
          nextRetryAt: new Date(
            now.getTime() + retryDelayMs(publication.attempts),
          ),
          updatedAt: now,
        })
        .where(eq(telegramPublications.id, publication.id));
      result.retried += 1;
    }
  }

  return result;
}
