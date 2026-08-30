import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema/applications";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { users } from "@/db/schema/users";

export type EmployerAccessResult =
  | {
      ok: true;
      applicationId: string;
      organizationId: string;
    }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" };

/**
 * Verifies that an ORGANIZATION_ADMIN user may access the given application
 * through their organization membership. The authoritative chain is:
 *   session userId → application → job → organization → membership
 *
 * Never authorizes from a client-supplied organizationId.
 */
export async function assertEmployerApplicationAccess(
  userId: string,
  applicationId: string,
): Promise<EmployerAccessResult> {
  const row = await db
    .select({
      applicationId: applications.id,
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
    applicationId: r.applicationId,
    organizationId: r.organizationId,
  };
}
