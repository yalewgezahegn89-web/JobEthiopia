import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { jobSources } from "../../db/schema/jobSources";
import { canonicalizeUrl } from "../dedup/canonicalUrl";

export interface CreateJobSourceInput {
  jobId: string;
  sourceId: string;
  sourceUrl: string | null;
  externalId: string | null;
  rawHash: string;
}

/**
 * Creates a job-source linkage for an existing job and a given source.
 *
 * Used when a cross-source duplicate is detected (L3 CONTENT_HASH or
 * L4 ORG_TITLE_LOCATION) to associate the current source with the
 * matched existing job.
 *
 * This function is idempotent and race-safe:
 * - If the relationship already exists, returns the existing jobSourceId.
 * - Uses onConflictDoNothing where the schema supports it.
 * - Falls back to explicit existence check for combinations not covered
 *   by unique constraints (e.g., NULL externalId).
 *
 * Both the existence check and insertion occur inside a single database
 * transaction. Does NOT modify job content or other job_source rows.
 *
 * @returns The jobSourceId of the created or existing relationship
 * @throws Database errors propagate to the caller without being swallowed
 */
export async function createJobSource(
  input: CreateJobSourceInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    // Check if the relationship already exists for this (jobId, sourceId)
    const existing = await tx.query.jobSources.findFirst({
      where: and(
        eq(jobSources.jobId, input.jobId),
        eq(jobSources.sourceId, input.sourceId),
      ),
      columns: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const canonicalUrl = canonicalizeUrl(input.sourceUrl);
    const effectiveSourceUrl =
      canonicalUrl ??
      input.sourceUrl?.trim() ??
      `jobethiopia://source/${input.sourceId}/external/${input.externalId ?? "none"}`;

    const [created] = await tx
      .insert(jobSources)
      .values({
        jobId: input.jobId,
        sourceId: input.sourceId,
        sourceUrl: effectiveSourceUrl,
        externalId: input.externalId,
        rawHash: input.rawHash,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return created.id;
    }

    // Conflict occurred (e.g., same sourceId + externalId already exists).
    // Read back the existing row.
    const conflictRow = await tx.query.jobSources.findFirst({
      where: and(
        eq(jobSources.jobId, input.jobId),
        eq(jobSources.sourceId, input.sourceId),
      ),
      columns: { id: true },
    });

    if (conflictRow) {
      return conflictRow.id;
    }

    // Fallback: should not reach here under normal circumstances
    throw new Error(
      `Failed to create or find job_source for job ${input.jobId} and source ${input.sourceId}`,
    );
  });
}
