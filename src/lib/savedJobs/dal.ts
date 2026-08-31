/**
 * Candidate saved-jobs business logic (Batch 90).
 *
 * Identity is never taken from client input: every function takes an explicit
 * `candidateUserId` resolved server-side from the verified session.
 * Saving is only allowed for jobs with status PUBLISHED. Saved rows are
 * retained when a job later becomes EXPIRED or REMOVED.
 */
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedJobs } from "@/db/schema/savedJobs";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { locations } from "@/db/schema/locations";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SaveJobResult =
  | {
      ok: true;
      saved: boolean;
      jobId: string;
    }
  | { ok: false; code: "JOB_NOT_FOUND" | "JOB_NOT_SAVEABLE" };

export type SavedJobListItem = {
  id: string;
  jobId: string;
  title: string;
  slug: string;
  organizationName: string | null;
  locationName: string | null;
  deadline: string | null;
  jobStatus: string | null;
  savedAt: string;
};

export type SavedJobList = {
  items: SavedJobListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("saved_jobs_candidate_user_id_job_id_unique") ||
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * Returns true when the candidate currently has a saved row for the given job.
 * Returns false for a missing job, an already-deleted row, or any other state.
 */
export async function isJobSaved(
  candidateUserId: string,
  jobId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(jobId)) return false;

  const row = await db.query.savedJobs.findFirst({
    where: and(
      eq(savedJobs.candidateUserId, candidateUserId),
      eq(savedJobs.jobId, jobId),
    ),
    columns: { id: true },
  });

  return row !== null && row !== undefined;
}

/**
 * Saves a job for the given candidate. Only PUBLISHED jobs may be saved.
 * Idempotent: a duplicate save of an already-saved job resolves to a success.
 */
export async function saveJob(
  candidateUserId: string,
  jobId: string,
): Promise<SaveJobResult> {
  if (!UUID_PATTERN.test(jobId)) {
    return { ok: false, code: "JOB_NOT_FOUND" };
  }

  try {
    const job = await db
      .select({ id: jobs.id, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (job.length === 0) {
      return { ok: false, code: "JOB_NOT_FOUND" };
    }
    if (job[0].status !== "PUBLISHED") {
      return { ok: false, code: "JOB_NOT_SAVEABLE" };
    }

    try {
      await db.insert(savedJobs).values({
        candidateUserId,
        jobId,
      });
    } catch (err: unknown) {
      if (!isUniqueViolation(err)) {
        throw err;
      }
      // Duplicate save resolves idempotently to already-saved.
    }

    return { ok: true, saved: true, jobId };
  } catch {
    return { ok: false, code: "JOB_NOT_FOUND" };
  }
}

/**
 * Removes a saved row scoped to the given candidate and job.
 * Deleting an absent record is idempotent.
 */
export async function unsaveJob(
  candidateUserId: string,
  jobId: string,
): Promise<{ ok: true }> {
  if (UUID_PATTERN.test(jobId)) {
    await db
      .delete(savedJobs)
      .where(
        and(
          eq(savedJobs.candidateUserId, candidateUserId),
          eq(savedJobs.jobId, jobId),
        ),
      );
  }
  return { ok: true };
}

/**
 * Lists the authenticated candidate's saved jobs, newest saved first, joined
 * with the job, organization, and location context. Only rows owned by the
 * given candidate are ever returned.
 */
export async function listSavedJobs(
  candidateUserId: string,
  query: { page?: number; limit?: number } = {},
): Promise<SavedJobList> {
  const page = Math.max(
    1,
    Number.isFinite(query.page) ? Math.trunc(query.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(query.limit) ? Math.trunc(query.limit ?? 20) : 20),
  );
  const offset = (page - 1) * limit;

  const where = eq(savedJobs.candidateUserId, candidateUserId);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: savedJobs.id,
        jobId: savedJobs.jobId,
        title: jobs.title,
        slug: jobs.slug,
        organizationName: organizations.name,
        locationName: locations.name,
        deadline: jobs.deadline,
        jobStatus: jobs.status,
        savedAt: savedJobs.createdAt,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .leftJoin(locations, eq(locations.id, jobs.locationId))
      .where(where)
      .orderBy(desc(savedJobs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedJobs)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      title: row.title,
      slug: row.slug,
      organizationName: row.organizationName,
      locationName: row.locationName,
      deadline: row.deadline ? row.deadline.toISOString() : null,
      jobStatus: row.jobStatus,
      savedAt: row.savedAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Returns the count of the candidate's saved jobs. Used to render a small
 * count on the saved-jobs page; cheap single-row aggregate.
 */
export async function getSavedJobsCount(
  candidateUserId: string,
): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(savedJobs)
    .where(eq(savedJobs.candidateUserId, candidateUserId));
  return rows[0]?.value ?? 0;
}