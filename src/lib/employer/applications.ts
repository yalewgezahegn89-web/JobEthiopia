import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { users } from "@/db/schema/users";
import { candidateProfiles } from "@/db/schema/candidateProfiles";
import { locations } from "@/db/schema/locations";
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
  candidatePhone: string | null;
  candidateLocationName: string | null;
  candidateProfessionalSummary: string | null;
  candidateTotalExperienceYears: number | null;
  candidateEducation: string | null;
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
      candidatePhone: candidateProfiles.phone,
      candidateLocationName: locations.name,
      candidateProfessionalSummary: candidateProfiles.professionalSummary,
      candidateTotalExperienceYears: candidateProfiles.totalExperienceYears,
      candidateEducation: candidateProfiles.education,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .innerJoin(users, eq(users.id, applications.candidateUserId))
    .leftJoin(
      candidateProfiles,
      eq(candidateProfiles.candidateId, applications.candidateUserId),
    )
    .leftJoin(
      locations,
      eq(locations.id, candidateProfiles.locationId),
    )
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
    candidatePhone: r.candidatePhone,
    candidateLocationName: r.candidateLocationName,
    candidateProfessionalSummary: r.candidateProfessionalSummary,
    candidateTotalExperienceYears: r.candidateTotalExperienceYears,
    candidateEducation: r.candidateEducation,
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

export type BulkChangeStatusResult =
  | {
      ok: true;
      items: { id: string; status: ApplicationStatus }[];
      count: number;
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "ORG_INACTIVE"
        | "USER_INACTIVE"
        | "INVALID_TRANSITION"
        | "MIXED_ORG";
    };

/**
 * Changes the status of many applications in one atomic, all-or-nothing
 * operation (B93).
 *
 * Authorization is batch-scoped and deliberately stronger than a per-item ad
 * hoc check:
 *   - The actor must be an active ORGANIZATION_ADMIN.
 *   - Every selected application must resolve to the SAME organization.
 *   - The actor must be a member of that organization.
 *   - That organization must be ACTIVE.
 *   - Every application's current status must legally transition to the target.
 *
 * The request never carries an organizationId; scope is derived exclusively
 * from the session user and the selected applications.
 *
 * All validation happens inside ONE transaction. If any item is invalid the
 * whole batch fails: no status is changed and no audit row is written. A
 * conditional UPDATE guarded by the set of allowed source statuses, plus a
 * returned-row-count check, protects against concurrent stale transitions.
 *
 * NOTE: This bulk operation can send up to 50 candidate notifications (one per
 * changed application) once the committed result is dispatched by the route.
 * Notification handling lives strictly OUTSIDE this transaction.
 */
export async function changeEmployerApplicationStatuses(
  userId: string,
  applicationIds: string[],
  newStatus: ApplicationStatus,
): Promise<BulkChangeStatusResult> {
  if (applicationIds.length === 0) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const actor = await tx
        .select({ role: users.role, active: users.isActive })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (
        actor.length === 0 ||
        actor[0].role !== "ORGANIZATION_ADMIN" ||
        !actor[0].active
      ) {
        return { ok: false as const, code: "FORBIDDEN" as const };
      }

      const rows = await tx
        .select({
          applicationId: applications.id,
          currentStatus: applications.status,
          organizationId: jobs.organizationId,
          orgStatus: organizations.status,
        })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
        .where(inArray(applications.id, applicationIds));

      if (rows.length !== applicationIds.length) {
        return { ok: false as const, code: "NOT_FOUND" as const };
      }

      const orgIds = new Set(rows.map((r) => r.organizationId));
      if (orgIds.size !== 1) {
        return { ok: false as const, code: "MIXED_ORG" as const };
      }

      const orgId = rows[0]!.organizationId;
      const orgStatus = rows[0]!.orgStatus;

      if (orgStatus !== "ACTIVE") {
        return { ok: false as const, code: "ORG_INACTIVE" as const };
      }

      const membership = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, orgId),
          ),
        )
        .limit(1);

      if (membership.length === 0) {
        return { ok: false as const, code: "FORBIDDEN" as const };
      }

      // Allowed source statuses that can legally reach the target, derived from
      // the authoritative VALID_TRANSITIONS table.
      const allowedCurrentStatuses = (
        Object.keys(VALID_TRANSITIONS) as ApplicationStatus[]
      ).filter((source) => VALID_TRANSITIONS[source]!.includes(newStatus));

      for (const r of rows) {
        const current = r.currentStatus as ApplicationStatus;
        if (!VALID_TRANSITIONS[current]?.includes(newStatus)) {
          return { ok: false as const, code: "INVALID_TRANSITION" as const };
        }
      }

      const updated = await tx
        .update(applications)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(
          and(
            inArray(applications.id, applicationIds),
            inArray(applications.status, allowedCurrentStatuses),
          ),
        )
        .returning({ id: applications.id, status: applications.status });

      if (updated.length !== applicationIds.length) {
        // A concurrent update removed at least one application from the allowed
        // source statuses. Throw so the whole transaction rolls back.
        throw new Error("bulk status change row-count mismatch");
      }

      for (const r of rows) {
        await tx.insert(auditLog).values({
          actorUserId: userId,
          action: "APPLICATION_STATUS_CHANGED",
          targetType: "application",
          targetId: r.applicationId,
          metadata: {
            fromStatus: r.currentStatus,
            toStatus: newStatus,
          },
        });
      }

      const items = updated.map((u) => ({
        id: u.id,
        status: u.status as ApplicationStatus,
      }));
      return {
        ok: true as const,
        items,
        count: items.length,
      };
    });

    return result;
  } catch {
    // Transaction-level rollback (e.g. concurrent stale-state mismatch) is
    // surfaced as an invalid transition: nothing was committed.
    return { ok: false, code: "INVALID_TRANSITION" };
  }
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
