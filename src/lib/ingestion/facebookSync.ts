/**
 * Facebook-specific ingestion bookkeeping.
 *
 * Two safety behaviours live here:
 * 1. Drafts that are missing details a moderator must supply are flagged
 *    `NEEDS_REVIEW` with deterministic reasons in the audit log.
 * 2. Published listings that disappeared from the Page or changed upstream are
 *    flagged for review. Nothing is ever deleted or silently un-published.
 */
import { and, eq, inArray, notInArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobSources } from "@/db/schema/jobSources";
import { auditLog } from "@/db/schema/auditLog";
import { logInfo } from "@/lib/observability/logger";

export interface FacebookReviewItem {
  externalId: string;
  reasons: string[];
}

async function jobIdsForExternalIds(
  sourceId: string,
  externalIds: string[],
): Promise<Map<string, string>> {
  if (externalIds.length === 0) return new Map();

  const rows = await db
    .select({ jobId: jobSources.jobId, externalId: jobSources.externalId })
    .from(jobSources)
    .where(
      and(
        eq(jobSources.sourceId, sourceId),
        inArray(jobSources.externalId, externalIds),
      ),
    );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.externalId) map.set(row.externalId, row.jobId);
  }
  return map;
}

/**
 * Marks incomplete Facebook drafts as `NEEDS_REVIEW` and records the reasons.
 * Published or already-reviewed jobs are left untouched.
 */
export async function flagFacebookReviewItems(
  sourceId: string,
  items: FacebookReviewItem[],
): Promise<number> {
  if (items.length === 0) return 0;

  const externalIds = items.map((item) => item.externalId);
  const byExternalId = await jobIdsForExternalIds(sourceId, externalIds);
  if (byExternalId.size === 0) return 0;

  const jobIds = Array.from(byExternalId.values());
  const updated = await db
    .update(jobs)
    .set({ verificationStatus: "NEEDS_REVIEW" })
    .where(
      and(eq(jobs.status, "DRAFT"), inArray(jobs.id, jobIds)),
    )
    .returning({ id: jobs.id });

  if (updated.length > 0) {
    const updatedIds = new Set(updated.map((row) => row.id));
    const reasonsByJobId = new Map<string, string[]>();
    for (const item of items) {
      const jobId = byExternalId.get(item.externalId);
      if (jobId && updatedIds.has(jobId)) {
        reasonsByJobId.set(jobId, item.reasons);
      }
    }

    const auditRows = Array.from(reasonsByJobId.entries()).map(
      ([jobId, reasons]) => ({
        actorUserId: null,
        action: "FACEBOOK_POST_REVIEW_REQUIRED",
        targetType: "job",
        targetId: jobId,
        metadata: { sourceId, reasons },
      }),
    );

    if (auditRows.length > 0) {
      await db.insert(auditLog).values(auditRows);
    }
  }

  return updated.length;
}

/**
 * Flags published Facebook listings whose content changed upstream.
 */
export async function flagFacebookChangedJobs(
  jobIds: string[],
): Promise<number> {
  if (jobIds.length === 0) return 0;

  const updated = await db
    .update(jobs)
    .set({ verificationStatus: "NEEDS_REVIEW" })
    .where(
      and(
        eq(jobs.status, "PUBLISHED"),
        inArray(jobs.id, jobIds),
        eq(jobs.verificationStatus, "VERIFIED"),
      ),
    )
    .returning({ id: jobs.id });

  return updated.length;
}

/**
 * Flags published listings that were not observed in the latest Page fetch.
 * This covers removed or edited-away posts; the job row is never deleted.
 */
export async function reconcileFacebookObserved(
  sourceId: string,
  observedExternalIds: string[],
): Promise<number> {
  const staleJobs = await db
    .select({ jobId: jobSources.jobId })
    .from(jobSources)
    .innerJoin(jobs, eq(jobs.id, jobSources.jobId))
    .where(
      and(
        eq(jobSources.sourceId, sourceId),
        eq(jobs.status, "PUBLISHED"),
        isNotNull(jobSources.externalId),
        observedExternalIds.length > 0
          ? notInArray(jobSources.externalId, observedExternalIds)
          : undefined,
      ),
    );

  const jobIds = Array.from(new Set(staleJobs.map((row) => row.jobId)));
  if (jobIds.length === 0) return 0;

  const updated = await db
    .update(jobs)
    .set({ verificationStatus: "NEEDS_REVIEW" })
    .where(
      and(eq(jobs.status, "PUBLISHED"), inArray(jobs.id, jobIds)),
    )
    .returning({ id: jobs.id });

  if (updated.length > 0) {
    await db.insert(auditLog).values(
      updated.map((row) => ({
        actorUserId: null,
        action: "FACEBOOK_POST_MISSING",
        targetType: "job",
        targetId: row.id,
        metadata: { sourceId },
      })),
    );
  }

  logInfo("facebook_reconciliation_completed", {
    sourceId,
    observed: observedExternalIds.length,
    flagged: updated.length,
  });

  return updated.length;
}
