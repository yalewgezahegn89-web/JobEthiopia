/**
 * Candidate-application business logic (Batch 77).
 *
 * Identity is never taken from client input: every function takes an explicit
 * `candidateUserId` resolved server-side from the verified session. Eligibility
 * (job PUBLISHED and deadline not passed) is enforced inside the DAL, not
 * delegated to maintenance, so the cutoff holds regardless of when the last
 * maintenance run happened.
 */
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { auditLog } from "@/db/schema/auditLog";

/* ── Status model (centralized) ───────────────────────────────────────── */

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "WITHDRAWN",
  "REVIEWING",
  "SHORTLISTED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/* ── Results ───────────────────────────────────────────────────────────── */

export type CreateApplicationResult =
  | {
      ok: true;
      item: {
        id: string;
        jobId: string;
        status: ApplicationStatus;
        createdAt: Date;
      };
    }
  | { ok: false; code: "JOB_NOT_FOUND" | "JOB_NOT_OPEN" | "DUPLICATE" };

export type WithdrawApplicationResult =
  | {
      ok: true;
      item: {
        id: string;
        jobId: string;
        status: ApplicationStatus;
        updatedAt: Date;
      };
    }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_WITHDRAWN" | "NOT_WITHDRAWABLE" };

export type CandidateApplicationListItem = {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationName: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type CandidateApplicationList = {
  items: CandidateApplicationListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OwnedApplication = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDuplicateError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("applications_job_id_candidate_user_id_unique") ||
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * Creates an application for the given candidate, atomically with the
 * APPLICATION_SUBMITTED audit event.
 */
export async function createApplication(input: {
  jobId: string;
  candidateUserId: string;
  coverLetter?: string;
}): Promise<CreateApplicationResult> {
  const coverLetter =
    input.coverLetter != null && input.coverLetter.length > 0
      ? input.coverLetter
      : null;

  try {
    const result = await db.transaction(async (tx) => {
      const job = await tx.query.jobs.findFirst({
        where: eq(jobs.id, input.jobId),
        columns: { id: true, status: true, deadline: true },
      });

      if (!job) return { ok: false as const, code: "JOB_NOT_FOUND" as const };

      const isOpen =
        job.status === "PUBLISHED" &&
        (job.deadline === null ||
          job.deadline.getTime() > Date.now());

      if (!isOpen) return { ok: false as const, code: "JOB_NOT_OPEN" as const };

      const [application] = await tx
        .insert(applications)
        .values({
          jobId: input.jobId,
          candidateUserId: input.candidateUserId,
          coverLetter,
        })
        .returning({
          id: applications.id,
          status: applications.status,
          createdAt: applications.createdAt,
        });

      await tx.insert(auditLog).values({
        actorUserId: input.candidateUserId,
        action: "APPLICATION_SUBMITTED",
        targetType: "application",
        targetId: application.id,
        metadata: { jobId: input.jobId, status: "SUBMITTED" },
      });

      return {
        ok: true as const,
        item: {
          id: application.id,
          jobId: input.jobId,
          status: application.status,
          createdAt: application.createdAt,
        },
      };
    });

    return result;
  } catch (err: unknown) {
    if (isDuplicateError(err)) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

/**
 * Returns the authenticated candidate's application history, newest first.
 * Only rows owned by the given candidate are ever returned.
 */
export async function listApplicationsForCandidate(
  candidateUserId: string,
  query: { page?: number; limit?: number } = {},
): Promise<CandidateApplicationList> {
  const page = Math.max(
    1,
    Number.isFinite(query.page) ? Math.trunc(query.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(query.limit) ? Math.trunc(query.limit ?? 20) : 20),
  );
  const offset = (page - 1) * limit;

  const where = eq(applications.candidateUserId, candidateUserId);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        status: applications.status,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        jobTitle: jobs.title,
        organizationName: organizations.name,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .where(where)
      .orderBy(desc(applications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      organizationName: row.organizationName,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Loads a single application row only when it belongs to the given candidate.
 * Null when missing, not owned, or the id is not a UUID.
 */
export async function getOwnedApplication(
  applicationId: string,
  candidateUserId: string,
): Promise<OwnedApplication | null> {
  if (!UUID_PATTERN.test(applicationId)) return null;

  const row = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.candidateUserId, candidateUserId),
    ),
    columns: {
      id: true,
      jobId: true,
      status: true,
      coverLetter: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    status: row.status,
    coverLetter: row.coverLetter,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Withdraws the candidate's own SUBMITTED application, atomically with the
 * APPLICATION_WITHDRAWN audit event. Ownership is enforced server-side: another
 * candidate's application resolves to NOT_FOUND so no ownership is leaked.
 */
export async function withdrawApplication(
  applicationId: string,
  candidateUserId: string,
): Promise<WithdrawApplicationResult> {
  if (!UUID_PATTERN.test(applicationId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  return db.transaction(async (tx) => {
    const existing = await tx.query.applications.findFirst({
      where: and(
        eq(applications.id, applicationId),
        eq(applications.candidateUserId, candidateUserId),
      ),
      columns: { id: true, jobId: true, status: true },
    });

    if (!existing) return { ok: false as const, code: "NOT_FOUND" as const };
    if (existing.status === "WITHDRAWN") {
      return { ok: false as const, code: "ALREADY_WITHDRAWN" as const };
    }
    if (existing.status !== "SUBMITTED" && existing.status !== "REVIEWING") {
      return { ok: false as const, code: "NOT_WITHDRAWABLE" as const };
    }

    const fromStatus = existing.status;
    const now = new Date();
    const [updated] = await tx
      .update(applications)
      .set({ status: "WITHDRAWN", updatedAt: now })
      .where(eq(applications.id, existing.id))
      .returning({
        id: applications.id,
        status: applications.status,
        updatedAt: applications.updatedAt,
      });

    await tx.insert(auditLog).values({
      actorUserId: candidateUserId,
      action: "APPLICATION_WITHDRAWN",
      targetType: "application",
      targetId: existing.id,
      metadata: {
        jobId: existing.jobId,
        fromStatus,
        toStatus: "WITHDRAWN",
      },
    });

    return {
      ok: true as const,
      item: {
        id: updated.id,
        jobId: existing.jobId,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
    };
  });
}