import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { users } from "@/db/schema/users";

export type EmployerJobAccessResult =
  | {
      ok: true;
      jobId: string;
      organizationId: string;
    }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" };

/**
 * Verifies that an ORGANIZATION_ADMIN user may access the given job
 * through their organization membership. The authoritative chain is:
 *   session userId → job → organization → membership
 *
 * Never authorizes from a client-supplied organizationId.
 */
export async function assertEmployerJobAccess(
  userId: string,
  jobId: string,
): Promise<EmployerJobAccessResult> {
  const row = await db
    .select({
      jobId: jobs.id,
      organizationId: jobs.organizationId,
      orgStatus: organizations.status,
      userRole: users.role,
      userActive: users.isActive,
    })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .innerJoin(users, eq(users.id, userId))
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (row.length === 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const r = row[0];

  if (r.userRole !== "ORGANIZATION_ADMIN" || !r.userActive) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (r.orgStatus !== "ACTIVE") {
    return { ok: false, code: "FORBIDDEN" };
  }

  const membership = await db
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
    return { ok: false, code: "FORBIDDEN" };
  }

  return {
    ok: true,
    jobId: r.jobId,
    organizationId: r.organizationId,
  };
}

export type EmployerOrgAccessResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" };

/**
 * Verifies that an ORGANIZATION_ADMIN user may create jobs for the given organization.
 * Checks: active user, active organization, membership exists.
 */
export async function assertEmployerOrganizationAccess(
  userId: string,
  organizationId: string,
): Promise<EmployerOrgAccessResult> {
  const row = await db
    .select({
      organizationId: organizations.id,
      orgStatus: organizations.status,
      userRole: users.role,
      userActive: users.isActive,
    })
    .from(organizations)
    .innerJoin(users, eq(users.id, userId))
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (row.length === 0) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const r = row[0];

  if (r.userRole !== "ORGANIZATION_ADMIN" || !r.userActive) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (r.orgStatus !== "ACTIVE") {
    return { ok: false, code: "FORBIDDEN" };
  }

  const membership = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    return { ok: false, code: "FORBIDDEN" };
  }

  return { ok: true, organizationId: r.organizationId };
}
