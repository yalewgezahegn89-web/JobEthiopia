/**
 * Admin Telegram publication monitoring helpers.
 *
 * Callers are authenticated staff actions/pages; these helpers perform no
 * authorization themselves. They expose only publication metadata, never bot
 * credentials.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { telegramPublications } from "@/db/schema/telegramPublications";
import { auditLog } from "@/db/schema/auditLog";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const TELEGRAM_STATES = [
  "QUEUED",
  "SENDING",
  "RETRY",
  "SENT",
  "FAILED",
  "SKIPPED",
] as const;

export type TelegramState = (typeof TELEGRAM_STATES)[number];

export interface TelegramPublicationSummary {
  id: string;
  jobId: string;
  jobTitle: string | null;
  jobStatus: string | null;
  channel: string;
  state: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  telegramMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface TelegramPublicationList {
  items: TelegramPublicationSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: Record<string, number>;
}

export async function listTelegramPublications(input: {
  page?: number;
  limit?: number;
  state?: string;
}): Promise<TelegramPublicationList> {
  const page = Math.max(
    1,
    Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 25) : 25),
  );
  const offset = (page - 1) * limit;

  const stateFilter = input.state
    ? (TELEGRAM_STATES as readonly string[]).includes(input.state)
      ? input.state
      : null
    : null;

  const where = stateFilter
    ? eq(telegramPublications.state, stateFilter as never)
    : undefined;

  const [rows, totalRows, countRows] = await Promise.all([
    db
      .select({
        id: telegramPublications.id,
        jobId: telegramPublications.jobId,
        jobTitle: jobs.title,
        jobStatus: jobs.status,
        channel: telegramPublications.channel,
        state: telegramPublications.state,
        attempts: telegramPublications.attempts,
        maxAttempts: telegramPublications.maxAttempts,
        nextRetryAt: telegramPublications.nextRetryAt,
        telegramMessageId: telegramPublications.telegramMessageId,
        lastError: telegramPublications.lastError,
        sentAt: telegramPublications.sentAt,
        createdAt: telegramPublications.createdAt,
      })
      .from(telegramPublications)
      .leftJoin(jobs, eq(telegramPublications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(telegramPublications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(telegramPublications)
      .where(where),
    db
      .select({
        state: telegramPublications.state,
        count: sql<number>`count(*)::int`,
      })
      .from(telegramPublications)
      .groupBy(telegramPublications.state),
  ]);

  const counts: Record<string, number> = {};
  for (const row of countRows) counts[row.state] = row.count;

  const total = totalRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      jobStatus: row.jobStatus,
      channel: row.channel,
      state: row.state,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextRetryAt: row.nextRetryAt ? row.nextRetryAt.toISOString() : null,
      telegramMessageId: row.telegramMessageId,
      lastError: row.lastError,
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
  };
}

export type RetryResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "NOT_RETRYABLE" };

/**
 * Re-queues a failed or skipped publication.
 *
 * SENT rows are never retried (that would duplicate the channel post).
 * Attempts are reset so the retry gets the full backoff budget.
 */
export async function retryTelegramPublication(
  publicationId: string,
  actorUserId: string,
): Promise<RetryResult> {
  if (!UUID_REGEX.test(publicationId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.telegramPublications.findFirst({
    where: eq(telegramPublications.id, publicationId),
    columns: { id: true, jobId: true, state: true, attempts: true },
  });
  if (!existing) return { ok: false, code: "NOT_FOUND" };

  if (existing.state !== "FAILED" && existing.state !== "SKIPPED") {
    return { ok: false, code: "NOT_RETRYABLE" };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(telegramPublications)
      .set({
        state: "QUEUED",
        attempts: 0,
        nextRetryAt: now,
        lastError: null,
        telegramMessageId: null,
        sentAt: null,
        updatedAt: now,
      })
      .where(eq(telegramPublications.id, publicationId));

    await tx.insert(auditLog).values({
      actorUserId,
      action: "TELEGRAM_PUBLICATION_REQUEUED",
      targetType: "job",
      targetId: existing.jobId,
      metadata: {
        publicationId,
        previousState: existing.state,
        previousAttempts: existing.attempts,
      },
    });
  });

  return { ok: true };
}

export async function retryFailedTelegramPublications(
  actorUserId: string,
): Promise<{ requeued: number }> {
  const failed = await db
    .select({ id: telegramPublications.id })
    .from(telegramPublications)
    .where(
      and(
        inArray(telegramPublications.state, ["FAILED", "SKIPPED"]),
        sql`${telegramPublications.attempts} <= ${telegramPublications.maxAttempts}`,
      ),
    )
    .limit(100);

  for (const row of failed) {
    await retryTelegramPublication(row.id, actorUserId);
  }

  return { requeued: failed.length };
}
