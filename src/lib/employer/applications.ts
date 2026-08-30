import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { users } from "@/db/schema/users";
import { auditLog } from "@/db/schema/auditLog";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";

type ApplicationStatus =
  | "SUBMITTED"
  | "WITHDRAWN"
  | "REVIEWING"
  | "SHORTLISTED"
  | "REJECTED";

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ["REVIEWING", "SHORTLISTED", "REJECTED"],
  REVIEWING: ["SHORTLISTED", "REJECTED"],
  WITHDRAWN: [],
  SHORTLISTED: [],
  REJECTED: [],
};

export type EmployerApplicationListItem = {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationId: string;
  organizationName: string;
  candidateName: string;
  candidateEmail: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type EmployerApplicationList = {
  items: EmployerApplicationListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type EmployerApplicationDetail = {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationName: string;
  candidateName: string;
  candidateEmail: string;
  coverLetter: string | null;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ChangeStatusResult =
  | { ok: true; item: { id: string; status: ApplicationStatus } }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "INVALID_TRANSITION"
        | "ORG_INACTIVE"
        | "USER_INACTIVE";
    };

export type ApplicationSort = "newest" | "oldest" | "updated";

/**
 * Lists all applications across the user's organization memberships.
 */
export async function listEmployerApplications(
  userId: string,
  filters: {
    status?: ApplicationStatus;
    jobId?: string;
    sort?: ApplicationSort;
    page?: number;
    limit?: number;
  } = {},
): Promise<EmployerApplicationList> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) {
    return {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    };
  }

  const page = Math.max(
    1,
    Number.isFinite(filters.page) ? Math.trunc(filters.page ?? 1) : 1,
  );
  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.isFinite(filters.limit) ? Math.trunc(filters.limit ?? 20) : 20,
    ),
  );
  const offset = (page - 1) * limit;

  const conditions = [inArray(jobs.organizationId, orgIds)];

  if (filters.status) {
    conditions.push(eq(applications.status, filters.status));
  }
  if (filters.jobId) {
    conditions.push(eq(applications.jobId, filters.jobId));
  }

  const where = and(...conditions);

  const sort = filters.sort ?? "newest";

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        jobTitle: jobs.title,
        organizationId: jobs.organizationId,
        organizationName: organizations.name,
        candidateName: users.name,
        candidateEmail: users.email,
        status: applications.status,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .innerJoin(users, eq(users.id, applications.candidateUserId))
      .where(where)
      .orderBy(
        sort === "oldest"
          ? asc(applications.createdAt)
          : sort === "updated"
            ? desc(applications.updatedAt)
            : desc(applications.createdAt),
        sort === "updated" ? desc(applications.createdAt) : desc(applications.id),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      candidateName: row.candidateName,
      candidateEmail: row.candidateEmail,
      status: row.status as ApplicationStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Gets a single application detail for employer view.
 */
export async function getEmployerApplication(
  userId: string,
  applicationId: string,
): Promise<EmployerApplicationDetail | null> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) return null;

  const row = await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      jobTitle: jobs.title,
      organizationName: organizations.name,
      candidateName: users.name,
      candidateEmail: users.email,
      coverLetter: applications.coverLetter,
      status: applications.status,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .innerJoin(users, eq(users.id, applications.candidateUserId))
    .where(
      and(
        eq(applications.id, applicationId),
        inArray(jobs.organizationId, orgIds),
      ),
    )
    .limit(1);

  if (row.length === 0) return null;

  const r = row[0];
  return {
    id: r.id,
    jobId: r.jobId,
    jobTitle: r.jobTitle,
    organizationName: r.organizationName,
    candidateName: r.candidateName,
    candidateEmail: r.candidateEmail,
    coverLetter: r.coverLetter,
    status: r.status as ApplicationStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Changes application status by employer. Uses a transaction to ensure
 * atomicity of validation + update + audit.
 */
export async function changeEmployerApplicationStatus(
  userId: string,
  applicationId: string,
  newStatus: ApplicationStatus,
): Promise<ChangeStatusResult> {
  return db.transaction(async (tx) => {
    const row = await tx
      .select({
        applicationId: applications.id,
        currentStatus: applications.status,
        organizationId: jobs.organizationId,
        orgStatus: organizations.status,
        userRole: users.role,
        userActive: users.isActive,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
      .innerJoin(users, eq(users.id, userId))
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (row.length === 0) {
      return { ok: false, code: "NOT_FOUND" as const };
    }

    const r = row[0];

    if (r.userRole !== "ORGANIZATION_ADMIN" || !r.userActive) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    if (r.orgStatus !== "ACTIVE") {
      return { ok: false, code: "ORG_INACTIVE" as const };
    }

    const membership = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, r.organizationId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      return { ok: false, code: "FORBIDDEN" as const };
    }

    const currentStatus = r.currentStatus as ApplicationStatus;
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return { ok: false, code: "INVALID_TRANSITION" as const };
    }

    const [updated] = await tx
      .update(applications)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(applications.id, applicationId))
      .returning({
        id: applications.id,
        status: applications.status,
      });

    await tx.insert(auditLog).values({
      actorUserId: userId,
      action: "APPLICATION_STATUS_CHANGED",
      targetType: "application",
      targetId: applicationId,
      metadata: { fromStatus: currentStatus, toStatus: newStatus },
    });

    return {
      ok: true,
      item: { id: updated.id, status: updated.status as ApplicationStatus },
    };
  });
}

export type ApplicationStatusHistoryEntry = {
  action: string;
  timestamp: Date;
  previousStatus: string | null;
  newStatus: string | null;
};

/**
 * Returns the status-change history for a single application, drawn from audit_log.
 * Only returns entries the caller is authorized to see (same org membership check).
 */
export async function getEmployerApplicationStatusHistory(
  userId: string,
  applicationId: string,
): Promise<ApplicationStatusHistoryEntry[]> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) return [];

  const appRow = await db
    .select({ organizationId: jobs.organizationId })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(
      and(
        eq(applications.id, applicationId),
        inArray(jobs.organizationId, orgIds),
      ),
    )
    .limit(1);

  if (appRow.length === 0) return [];

  const rows = await db
    .select({
      action: auditLog.action,
      timestamp: auditLog.createdAt,
      metadata: auditLog.metadata,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetType, "application"),
        eq(auditLog.targetId, applicationId),
        inArray(auditLog.action, [
          "APPLICATION_SUBMITTED",
          "APPLICATION_WITHDRAWN",
          "APPLICATION_STATUS_CHANGED",
        ]),
      ),
    )
    .orderBy(asc(auditLog.createdAt));

  return rows.map((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    return {
      action: row.action,
      timestamp: row.timestamp,
      previousStatus: (meta?.fromStatus as string) ?? null,
      newStatus: (meta?.toStatus as string) ?? null,
    };
  });
}

export type EmployerJobFilterItem = {
  id: string;
  title: string;
};

/**
 * Returns a lightweight list of jobs for the filter dropdown.
 * Scoped to the user's authorized organizations only.
 */
export async function listEmployerJobsForFilter(
  userId: string,
): Promise<EmployerJobFilterItem[]> {
  const orgIds = await getUserOrganizationIds(userId);
  if (orgIds.length === 0) return [];

  const rows = await db
    .select({ id: jobs.id, title: jobs.title })
    .from(jobs)
    .where(inArray(jobs.organizationId, orgIds))
    .orderBy(desc(jobs.createdAt));

  return rows.map((r) => ({ id: r.id, title: r.title }));
}
