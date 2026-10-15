import { eq } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema/jobs";
import { jobSources } from "../../db/schema/jobSources";

const PUBLISHED_STATUS = "PUBLISHED";

export interface UpdateJobInput {
  jobId: string;
  jobSourceId: string;
  normalizedTitle: string;
  normalizedDescription: string;
  locationId: string | null;
  professionId: string | null;
  categoryId: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  applicationUrl: string | null;
  rawHash: string;
}

/**
 * Compares a stored content hash with a newly computed hash.
 *
 * Returns true if the content has changed (or if no stored hash exists).
 */
export function contentChanged(
  storedHash: string | null,
  newHash: string,
): boolean {
  if (storedHash === null) return true;
  return storedHash !== newHash;
}

/**
 * Reads the stored rawHash for an existing job-source relationship.
 *
 * Returns null if the row does not exist or rawHash is null.
 *
 * @param jobSourceId - The ID of the job_sources row to read
 * @returns The stored rawHash, or null
 * @throws Database errors propagate to the caller
 */
export async function getStoredHash(
  jobSourceId: string,
): Promise<string | null> {
  const row = await db.query.jobSources.findFirst({
    where: eq(jobSources.id, jobSourceId),
    columns: { rawHash: true },
  });

  return row?.rawHash ?? null;
}

/**
 * Updates an existing job and its job-source linkage within a transaction.
 *
 * Updates job content fields and refreshes the jobSource rawHash and lastSeenAt.
 * Does NOT modify identity fields (id, slug, organizationId) or status fields.
 *
 * **Publication gate:** a PUBLISHED job's content is treated as moderated and
 * must not be silently rewritten by automated ingestion. When the target job
 * is PUBLISHED, content fields are left untouched and only the job-source
 * metadata (rawHash, lastSeenAt) is refreshed, keeping the job fresh/verified
 * without content drift. The return value reports whether content was applied.
 *
 * Both updates occur inside a single database transaction. If either fails,
 * the entire operation rolls back — no partial writes.
 *
 * @param input - The normalized fields to apply
 * @returns True if the job content was updated; false when the PUBLISHED gate
 *          blocked the content mutation (metadata was still refreshed).
 * @throws If the transaction fails, the error propagates without being swallowed
 */
export async function updateJob(input: UpdateJobInput): Promise<boolean> {
  let contentUpdated = true;

  await db.transaction(async (tx) => {
    const job = await tx
      .select({ id: jobs.id, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, input.jobId))
      .limit(1);

    if (job[0]?.status === PUBLISHED_STATUS) {
      contentUpdated = false;
    } else {
      await tx
        .update(jobs)
        .set({
          title: input.normalizedTitle,
          description: input.normalizedDescription,
          locationId: input.locationId,
          professionId: input.professionId,
          categoryId: input.categoryId,
          employmentType: input.employmentType as never,
          salaryMin: input.salaryMin != null ? String(input.salaryMin) : null,
          salaryMax: input.salaryMax != null ? String(input.salaryMax) : null,
          salaryCurrency: input.salaryCurrency,
          salaryPeriod: input.salaryPeriod as never,
          experienceMin: input.experienceMin,
          experienceMax: input.experienceMax,
          responsibilities: input.responsibilities,
          requirements: input.requirements,
          educationRequirements: input.educationRequirements,
          benefits: input.benefits,
          postedAt: input.postedAt,
          deadline: input.deadline,
          applicationUrl: input.applicationUrl,
        })
        .where(eq(jobs.id, input.jobId));
    }

    await tx
      .update(jobSources)
      .set({
        rawHash: input.rawHash,
        lastSeenAt: new Date(),
      })
      .where(eq(jobSources.id, input.jobSourceId));
  });

  return contentUpdated;
}
