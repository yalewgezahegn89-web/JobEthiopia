/**
 * Employer team management business logic (Batch 91).
 *
 * OPERATIONS ARE ORGANIZATION MEMBERSHIP ONLY. This module never creates or
 * deletes users, never changes a user's role, never issues invitations, and
 * never touches jobs/applications/candidate data.
 *
 * Identity is never taken from client input: `actorUserId` is resolved from the
 * verified session at the route boundary, and the target organization is
 * resolved from the database. A client-supplied organizationId is only a
 * requested target; membership verification determines authority.
 */
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { organizations } from "@/db/schema/organizations";
import { organizationMembers } from "@/db/schema/organizationMembers";
import { auditLog } from "@/db/schema/auditLog";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";

const ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN";

export type EmployerTeamMember = {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  joinedAt: Date;
};

export type AddEmployerTeamMemberResult =
  | {
      ok: true;
      item: EmployerTeamMember;
    }
  | {
      ok: false;
      code:
        | "ACTOR_NOT_AUTHORIZED"
        | "ORGANIZATION_NOT_FOUND"
        | "ORGANIZATION_INACTIVE"
        | "TARGET_USER_NOT_FOUND"
        | "TARGET_USER_INACTIVE"
        | "TARGET_NOT_ORGANIZATION_ADMIN"
        | "ALREADY_MEMBER"
        | "MEMBERSHIP_CREATE_FAILED";
    };

export type RemoveEmployerTeamMemberResult =
  | { ok: true; removed: true }
  | {
      ok: false;
      code:
        | "ACTOR_NOT_AUTHORIZED"
        | "ORGANIZATION_NOT_FOUND"
        | "ORGANIZATION_INACTIVE"
        | "MEMBERSHIP_NOT_FOUND"
        | "LAST_ADMIN"
        | "MEMBERSHIP_REMOVE_FAILED";
    };

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("organization_members_org_user_unique") ||
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * Lists the ORGANIZATION_ADMIN members of every ACTIVE organization the actor
 * belongs to. A row is returned per membership. Inactive target users remain
 * visible (a membership is a stored relationship) but are marked inactive.
 *
 * Only members whose role is ORGANIZATION_ADMIN are exposed. Password hashes,
 * sessions, candidate profiles, resumes, applications, and unrelated
 * organizations are never returned.
 */
export async function listEmployerTeam(
  actorUserId: string,
): Promise<EmployerTeamMember[]> {
  const orgIds = await getUserOrganizationIds(actorUserId);
  if (orgIds.length === 0) return [];

  const rows = await db
    .select({
      membershipId: organizationMembers.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        inArray(organizations.id, orgIds),
        eq(organizations.status, "ACTIVE"),
        eq(users.role, ORGANIZATION_ADMIN),
      ),
    )
    .orderBy(organizations.name, users.name);

  return rows.map((r) => ({
    membershipId: r.membershipId,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    isActive: r.isActive,
    joinedAt: r.joinedAt,
  }));
}

/**
 * Returns the ACTIVE organizations the actor belongs to, used to populate the
 * add-member organization selector. Never returns organizations the actor is
 * not a member of.
 */
export async function getEmployerTeamOrganizations(
  actorUserId: string,
): Promise<{ id: string; name: string }[]> {
  const orgIds = await getUserOrganizationIds(actorUserId);
  if (orgIds.length === 0) return [];

  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(
      and(
        inArray(organizations.id, orgIds),
        eq(organizations.status, "ACTIVE"),
      ),
    )
    .orderBy(organizations.name);

  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Adds an EXISTING active ORGANIZATION_ADMIN user to an organization by exact
 * email. Runs inside a single transaction so that authorization, target
 * validation, the insert, and the audit event are atomic.
 *
 * targetUserId is resolved here from the exact email; a client-supplied user id
 * is never accepted. Duplicate memberships resolve to ALREADY_MEMBER rather
 * than an unhandled database error.
 */
export async function addEmployerTeamMember(
  actorUserId: string,
  organizationId: string,
  email: string,
): Promise<AddEmployerTeamMemberResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, code: "TARGET_USER_NOT_FOUND" };
  }

  try {
    return await db.transaction(async (tx) => {
      const actorRow = await tx
        .select({ role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, actorUserId))
        .limit(1);

      if (
        actorRow.length === 0 ||
        actorRow[0].role !== ORGANIZATION_ADMIN ||
        !actorRow[0].isActive
      ) {
        return { ok: false as const, code: "ACTOR_NOT_AUTHORIZED" as const };
      }

      const orgRow = await tx
        .select({ id: organizations.id, name: organizations.name, status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (orgRow.length === 0) {
        return { ok: false as const, code: "ORGANIZATION_NOT_FOUND" as const };
      }
      if (orgRow[0].status !== "ACTIVE") {
        return { ok: false as const, code: "ORGANIZATION_INACTIVE" as const };
      }

      const actorMembership = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, actorUserId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (actorMembership.length === 0) {
        return { ok: false as const, code: "ACTOR_NOT_AUTHORIZED" as const };
      }

      const targetRow = await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (targetRow.length === 0) {
        return { ok: false as const, code: "TARGET_USER_NOT_FOUND" as const };
      }

      const target = targetRow[0];

      if (!target.isActive) {
        return { ok: false as const, code: "TARGET_USER_INACTIVE" as const };
      }
      if (target.role !== ORGANIZATION_ADMIN) {
        return {
          ok: false as const,
          code: "TARGET_NOT_ORGANIZATION_ADMIN" as const,
        };
      }

      let created;
      try {
        [created] = await tx
          .insert(organizationMembers)
          .values({ organizationId, userId: target.id })
          .returning({
            id: organizationMembers.id,
            organizationId: organizationMembers.organizationId,
            userId: organizationMembers.userId,
            createdAt: organizationMembers.createdAt,
          });
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          return { ok: false as const, code: "ALREADY_MEMBER" as const };
        }
        throw err;
      }

      if (!created) {
        return {
          ok: false as const,
          code: "MEMBERSHIP_CREATE_FAILED" as const,
        };
      }

      await tx.insert(auditLog).values({
        actorUserId,
        action: "ORGANIZATION_MEMBER_ADDED",
        targetType: "organization_member",
        targetId: created.id,
        metadata: { organizationId, targetUserId: target.id },
      });

      return {
        ok: true as const,
        item: {
          membershipId: created.id,
          organizationId: created.organizationId,
          organizationName: orgRow[0].name,
          userId: target.id,
          name: target.name,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
          joinedAt: created.createdAt,
        },
      };
    });
  } catch {
    return { ok: false, code: "MEMBERSHIP_CREATE_FAILED" };
  }
}

/**
 * Resolves a membership id to its organization and member user id, purely from
 * the database. This lets the DELETE route authorize from the membership's
 * stored organization rather than any client-supplied organization id.
 * Returns null when the membership does not exist.
 */
export async function resolveEmployerTeamMembership(membershipId: string): Promise<{
  organizationId: string;
  targetUserId: string;
} | null> {
  const row = await db
    .select({
      organizationId: organizationMembers.organizationId,
      targetUserId: organizationMembers.userId,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.id, membershipId))
    .limit(1);

  return row.length === 0 ? null : row[0];
}

/**
 * Removes an ORGANIZATION_ADMIN membership. Runs inside a single transaction so
 * that the authorization checks, the active-admin count, the delete, and the
 * audit event are atomic.
 *
 * An ACTIVE organization must always retain at least one active
 * ORGANIZATION_ADMIN membership. If the target is the last active admin, the
 * removal is rejected (consistently, whether the actor is removing themselves
 * or a colleague). Only the membership row is deleted — never the user, and
 * never a role change.
 */
export async function removeEmployerTeamMember(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
): Promise<RemoveEmployerTeamMemberResult> {
  try {
    return await db.transaction(async (tx) => {
      const actorRow = await tx
        .select({ role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, actorUserId))
        .limit(1);

      if (
        actorRow.length === 0 ||
        actorRow[0].role !== ORGANIZATION_ADMIN ||
        !actorRow[0].isActive
      ) {
        return { ok: false as const, code: "ACTOR_NOT_AUTHORIZED" as const };
      }

      const orgRow = await tx
        .select({ id: organizations.id, name: organizations.name, status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (orgRow.length === 0) {
        return { ok: false as const, code: "ORGANIZATION_NOT_FOUND" as const };
      }
      if (orgRow[0].status !== "ACTIVE") {
        return { ok: false as const, code: "ORGANIZATION_INACTIVE" as const };
      }

      const actorMembership = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, actorUserId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (actorMembership.length === 0) {
        return { ok: false as const, code: "ACTOR_NOT_AUTHORIZED" as const };
      }

      const targetMembership = await tx
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, targetUserId),
          ),
        )
        .limit(1);

      if (targetMembership.length === 0) {
        return { ok: false as const, code: "MEMBERSHIP_NOT_FOUND" as const };
      }

      const targetUser = await tx
        .select({ id: users.id, role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (targetUser.length === 0) {
        return { ok: false as const, code: "MEMBERSHIP_NOT_FOUND" as const };
      }

      // Count active ORGANIZATION_ADMIN memberships for the organization.
      const adminCount = await tx
        .select({ count: count() })
        .from(organizationMembers)
        .innerJoin(users, eq(users.id, organizationMembers.userId))
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(users.role, ORGANIZATION_ADMIN),
            eq(users.isActive, true),
          ),
        );

      const countValue = Number(adminCount[0]?.count ?? 0);

      const targetIsActiveAdmin =
        targetUser[0].role === ORGANIZATION_ADMIN && targetUser[0].isActive;

      if (targetIsActiveAdmin && countValue <= 1) {
        return { ok: false as const, code: "LAST_ADMIN" as const };
      }

      await tx
        .delete(organizationMembers)
        .where(eq(organizationMembers.id, targetMembership[0].id));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "ORGANIZATION_MEMBER_REMOVED",
        targetType: "organization_member",
        targetId: targetMembership[0].id,
        metadata: { organizationId, targetUserId },
      });

      return { ok: true as const, removed: true as const };
    });
  } catch {
    return { ok: false, code: "MEMBERSHIP_REMOVE_FAILED" };
  }
}
