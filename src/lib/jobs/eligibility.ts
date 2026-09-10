/**
 * Shared public-job eligibility conditions (Phase 7 Batch 6).
 *
 * A job is eligible for public display (and for job-alert matching) when ALL
 * of the following hold:
 *   - status is PUBLISHED
 *   - lastVerifiedAt is set and fresh (strictly newer than the stale cutoff;
 *     isJobStale treats elapsed >= DEFAULT_STALE_MAX_AGE_DAYS as stale, so the
 *     query requires `>` on the cutoff to hide such jobs there too)
 *   - deadline is null (rolling) or in the future
 *   - the owning organization is ACTIVE
 *
 * This is the single authoritative source for the "genuinely public job"
 * rules so the public list endpoint and the job-alert matcher cannot drift.
 */
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { jobs } from "@/db/schema/jobs";
import { DEFAULT_STALE_MAX_AGE_DAYS } from "./public";

/**
 * Builds the WHERE conditions for genuinely public jobs.
 *
 * Always returns an array (possibly empty) suitable for `and(...conditions)`.
 * When no active organization exists the caller must surface zero results; the
 * `1 = 0` condition inserted here does exactly that.
 */
export async function buildPublicJobEligibilityConditions(
  now?: Date,
): Promise<(SQL | undefined)[]> {
  const reference = now ?? new Date();
  const staleCutoff = new Date(
    reference.getTime() - DEFAULT_STALE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );

  const activeOrgRows = await db.query.organizations.findMany({
    columns: { id: true },
    where: eq(organizations.status, "ACTIVE"),
  });
  const activeOrgIds = activeOrgRows.map((row) => row.id);

  const conditions: (SQL | undefined)[] = [
    eq(jobs.status, "PUBLISHED"),
    // Freshness: a job verified exactly DEFAULT_STALE_MAX_AGE_DAYS ago is
    // stale (isJobStale treats elapsed >= 30d as stale), so the list must
    // require `>` on the cutoff to hide it there too.
    sql`${jobs.lastVerifiedAt} IS NOT NULL AND ${jobs.lastVerifiedAt} > ${staleCutoff.toISOString()}`,
    sql`(${jobs.deadline} IS NULL OR ${jobs.deadline} >= ${reference.toISOString()})`,
  ];

  if (activeOrgIds.length > 0) {
    conditions.push(inArray(jobs.organizationId, activeOrgIds));
  } else {
    conditions.push(sql`1 = 0`);
  }

  return conditions;
}