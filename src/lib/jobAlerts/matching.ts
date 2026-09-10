/**
 * Job-alert matching (Phase 7 Batch 6).
 *
 * A job matches an alert when:
 *   - it is genuinely public (shared eligibility rules, exactly the same rules
 *     as the public list endpoint — see @/lib/jobs/eligibility)
 *   - it satisfies every set filter: category, profession, location,
 *     employment type (each set filter ANDs)
 *   - every keyword token (whitespace/comma separated) appears in the job
 *     title, description, or organization name (case-insensitive, LIKE-escaped)
 *   - it has not already been delivered for this alert (dedup)
 */
import { and, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { locations } from "@/db/schema/locations";
import { jobAlertDeliveries } from "@/db/schema/jobAlertDeliveries";
import { buildPublicJobEligibilityConditions } from "@/lib/jobs/eligibility";
import { escapeLikePattern } from "@/lib/apiUtils";
import type { JobAlertRow } from "./dal";

export interface MatchedJob {
  id: string;
  title: string;
  slug: string;
  organizationId: string | null;
  organizationName: string | null;
  locationId: string | null;
  locationName: string | null;
  employmentType: string | null;
  description: string | null;
  postedAt: Date | null;
  deadline: Date | null;
}

/**
 * Splits a keywords string into normalized matching tokens. Tokens are
 * separated by whitespace or commas and lowercased for case-insensitive
 * matching.
 */
export function splitAlertKeywords(keywords: string | null | undefined): string[] {
  if (!keywords) return [];
  return keywords
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

export interface MatchOptions {
  /** Restrict matching to these job ids (instant alerts for a single job). */
  restrictJobIds?: string[];
  limit?: number;
  now?: Date;
}

export async function matchJobsForAlert(
  alert: JobAlertRow,
  options: MatchOptions = {},
): Promise<MatchedJob[]> {
  const limit = options.limit ?? 20;

  const query = db
    .select({
      id: jobs.id,
      title: jobs.title,
      slug: jobs.slug,
      organizationId: jobs.organizationId,
      organizationName: organizations.name,
      locationId: jobs.locationId,
      locationName: locations.name,
      employmentType: jobs.employmentType,
      description: jobs.description,
      postedAt: jobs.postedAt,
      deadline: jobs.deadline,
    })
    .from(jobs)
    .leftJoin(organizations, eq(jobs.organizationId, organizations.id))
    .leftJoin(locations, eq(jobs.locationId, locations.id))
    .leftJoin(
      jobAlertDeliveries,
      and(
        eq(jobAlertDeliveries.alertId, alert.id),
        eq(jobAlertDeliveries.jobId, jobs.id),
      ),
    );

  const conditions: SQL[] = [];

  const eligibility = await buildPublicJobEligibilityConditions(options.now);
  for (const condition of eligibility) {
    if (condition) conditions.push(condition);
  }

  if (options.restrictJobIds?.length) {
    conditions.push(inArray(jobs.id, options.restrictJobIds));
  }

  if (alert.categoryId) conditions.push(eq(jobs.categoryId, alert.categoryId));
  if (alert.professionId) {
    conditions.push(eq(jobs.professionId, alert.professionId));
  }
  if (alert.locationId) conditions.push(eq(jobs.locationId, alert.locationId));
  if (alert.employmentType) {
    conditions.push(eq(jobs.employmentType, alert.employmentType as never));
  }

  const tokens = splitAlertKeywords(alert.keywords);
  if (tokens.length > 0) {
    const tokenConditions = tokens.map((token) => {
      const pattern = `%${escapeLikePattern(token)}%`;
      return or(
        ilike(jobs.title, pattern),
        ilike(jobs.description, pattern),
        ilike(organizations.name, pattern),
      );
    });
    const combinedTokenCondition = and(...tokenConditions);
    if (combinedTokenCondition) conditions.push(combinedTokenCondition);
  }

  // Never re-deliver a job already sent for this alert.
  conditions.push(isNull(jobAlertDeliveries.id));

  return query
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}