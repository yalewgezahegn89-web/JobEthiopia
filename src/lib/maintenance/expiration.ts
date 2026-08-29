import { and, eq, sql, lt } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { auditLog } from "@/db/schema/auditLog";

export type ExpirationResult = { expired: number };

/**
 * Expires published jobs whose deadlines have passed.
 *
 * Transitions: PUBLISHED → EXPIRED
 *
 * Rules:
 * - Only touches jobs where status = PUBLISHED AND deadline IS NOT NULL AND deadline < now
 * - Does NOT touch EXPIRED, REMOVED, DRAFT, or PENDING_REVIEW jobs
 * - Does NOT expire jobs with NULL deadline
 * - Does NOT expire jobs where deadline === now (strict less-than)
 * - Idempotent: running twice produces the same final state
 * - Concurrency-safe: concurrent UPDATEs on the same rows are safe because the
 *   WHERE clause excludes already-EXPIRED rows
 *
 * Audit:
 * - One JOB_AUTO_EXPIRED event per successfully transitioned job
 * - actorUserId is null (system action)
 * - Metadata contains only: fromStatus, toStatus, deadline
 * - Audit is written inside the same transaction as the status update for atomicity
 *
 * @param now - Deterministic timestamp for testing
 * @returns Count of expired jobs
 */
export async function expireDueJobs(now: Date): Promise<ExpirationResult> {
  const eligibleJobs = await db
    .select({ id: jobs.id, deadline: jobs.deadline })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "PUBLISHED"),
        sql`${jobs.deadline} IS NOT NULL`,
        lt(jobs.deadline, now),
      ),
    );

  if (eligibleJobs.length === 0) {
    return { expired: 0 };
  }

  let expired = 0;

  for (const job of eligibleJobs) {
    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(jobs)
          .set({
            status: "EXPIRED",
            updatedAt: now,
          })
          .where(
            and(
              eq(jobs.id, job.id),
              eq(jobs.status, "PUBLISHED"),
            ),
          )
          .returning({ id: jobs.id });

        if (updated) {
          await tx.insert(auditLog).values({
            actorUserId: null,
            action: "JOB_AUTO_EXPIRED",
            targetType: "job",
            targetId: job.id,
            metadata: {
              fromStatus: "PUBLISHED",
              toStatus: "EXPIRED",
              deadline: job.deadline?.toISOString() ?? null,
            },
          });
          expired += 1;
        }
      });
    } catch {
      // Individual job failure does not abort the entire run.
      // The transaction ensures no partial state: either both the update
      // and audit insert succeed, or neither does.
    }
  }

  return { expired };
}
