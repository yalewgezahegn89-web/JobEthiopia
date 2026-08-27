import { eq } from "drizzle-orm";
import { db } from "../../db";
import { jobSources } from "../../db/schema/jobSources";

/**
 * Updates the `lastSeenAt` timestamp for an existing job-source relationship.
 *
 * Called when a job is re-encountered through confirmed duplicate detection
 * (Level 1: SOURCE_IDENTIFIER or Level 2: SOURCE_URL) to track freshness.
 *
 * This function is **write-only** — it does not read or return any data.
 *
 * @param jobSourceId - The ID of the existing job_sources row to update
 * @throws Database errors propagate to the caller without being swallowed
 */
export async function updateLastSeenAt(jobSourceId: string): Promise<void> {
  await db
    .update(jobSources)
    .set({ lastSeenAt: new Date() })
    .where(eq(jobSources.id, jobSourceId));
}
