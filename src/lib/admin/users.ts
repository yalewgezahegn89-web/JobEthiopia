import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { sessions } from "@/db/schema/sessions";
import { auditLog } from "@/db/schema/auditLog";
import { revokeSessionsForUser } from "@/lib/auth/session";
import { USER_ROLES } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/roles";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type UserAdminSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
};

export type UserAdminPaginated = {
  items: UserAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type UserAuditEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actorEmail: string | null;
};

export async function listUsers(input: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  role?: UserRole;
}): Promise<UserAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isActive !== undefined) {
    filters.push(eq(users.isActive, input.isActive));
  }
  if (input.role) {
    filters.push(eq(users.role, input.role));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.users.findMany({
      where,
      orderBy: [desc(users.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  const userIds = rows.map((r) => r.id);
  const sessionCounts =
    userIds.length > 0
      ? await db
          .select({
            userId: sessions.userId,
            count: sql<number>`count(*)::int`,
          })
          .from(sessions)
          .where(
            sql`${sessions.userId} IN (${sql.join(
              userIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${sessions.expiresAt} > NOW()`,
          )
          .groupBy(sessions.userId)
      : [];

  const sessionCountMap = new Map(
    sessionCounts.map((sc) => [sc.userId, sc.count]),
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as UserRole,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      sessionCount: sessionCountMap.get(r.id) ?? 0,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export type UserAdminDetail = UserAdminSummary;

export async function getUser(id: string): Promise<UserAdminDetail | null> {
  if (!isValidUuid(id)) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  const [sessionCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    sessionCount: sessionCountResult?.count ?? 0,
  };
}

export async function getUserAuditHistory(userId: string): Promise<UserAuditEntry[]> {
  if (!isValidUuid(userId)) return [];

  const events = await db.query.auditLog.findMany({
    where: and(
      eq(auditLog.targetType, "user"),
      eq(auditLog.targetId, userId),
    ),
    orderBy: [desc(auditLog.createdAt)],
    limit: 50,
    columns: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actorUserId: true,
    },
  });

  if (events.length === 0) return [];

  const actorIds = Array.from(
    new Set(events.map((e) => e.actorUserId).filter(Boolean)),
  ) as string[];

  let actorEmails = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        sql`${users.id} IN (${sql.join(
          actorIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    actorEmails = new Map(actors.map((a) => [a.id, a.email]));
  }

  return events.map((e) => ({
    id: e.id,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    actorEmail: e.actorUserId
      ? actorEmails.get(e.actorUserId) ?? null
      : null,
  }));
}

export type ToggleActiveResult =
  | { ok: true; isActive: boolean }
  | { ok: false; code: "NOT_FOUND" | "SELF_DEACTIVATION" | "LAST_SUPER_ADMIN" | "UNAUTHORIZED" };

export async function toggleUserActive(
  targetUserId: string,
  actorUserId: string,
  actorRole: UserRole,
): Promise<ToggleActiveResult> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (actorRole !== "SUPER_ADMIN" && actorRole !== "ADMIN") {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  if (targetUserId === actorUserId) {
    return { ok: false, code: "SELF_DEACTIVATION" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id, isActive: users.isActive, role: users.role })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!existing) {
        return { ok: false as const, code: "NOT_FOUND" as const };
      }

      const newIsActive = !existing.isActive;

      if (!newIsActive && existing.role === "SUPER_ADMIN") {
        const [countResult] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(
            and(
              eq(users.role, "SUPER_ADMIN"),
              eq(users.isActive, true),
            ),
          );

        if (countResult.count <= 1) {
          return { ok: false as const, code: "LAST_SUPER_ADMIN" as const };
        }
      }

      if (existing.isActive === newIsActive) {
        return { ok: true as const, isActive: newIsActive };
      }

      await tx
        .update(users)
        .set({ isActive: newIsActive, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: newIsActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        targetType: "user",
        targetId: targetUserId,
        metadata: {
          fromIsActive: existing.isActive,
          toIsActive: newIsActive,
        },
      });

      return { ok: true as const, isActive: newIsActive };
    });

    return result;
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
}

export type RevokeSessionsResult =
  | { ok: true; sessionsRevoked: number }
  | { ok: false; code: "NOT_FOUND" | "SELF_FORCE_LOGOUT" };

export async function revokeUserSessions(
  targetUserId: string,
  actorUserId: string,
): Promise<RevokeSessionsResult> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (targetUserId === actorUserId) {
    return { ok: false, code: "SELF_FORCE_LOGOUT" };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
    columns: { id: true },
  });

  if (!user) {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const sessionsRevoked = await revokeSessionsForUser(targetUserId);

      await tx.insert(auditLog).values({
        actorUserId,
        action: "USER_SESSIONS_REVOKED",
        targetType: "user",
        targetId: targetUserId,
        metadata: { sessionsRevoked },
      });

      return { ok: true as const, sessionsRevoked };
    });

    return result;
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
}

const ALLOWED_ROLES = new Set<string>(USER_ROLES);

export type ChangeUserRoleResult =
  | { ok: true; fromRole: UserRole; toRole: UserRole }
  | { ok: false; code: "NOT_FOUND" | "SELF_CHANGE" | "LAST_SUPER_ADMIN" | "UNAUTHORIZED" | "INVALID_ROLE" };

export async function changeUserRole(
  targetUserId: string,
  newRole: UserRole,
  actorUserId: string,
): Promise<ChangeUserRoleResult> {
  if (!isValidUuid(targetUserId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (!ALLOWED_ROLES.has(newRole)) {
    return { ok: false, code: "INVALID_ROLE" };
  }

  if (targetUserId === actorUserId) {
    return { ok: false, code: "SELF_CHANGE" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [actor] = await tx
        .select({ id: users.id, role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, actorUserId))
        .limit(1);

      if (!actor || !actor.isActive || actor.role !== "SUPER_ADMIN") {
        return { ok: false as const, code: "UNAUTHORIZED" as const };
      }

      const [target] = await tx
        .select({ id: users.id, role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!target) {
        return { ok: false as const, code: "NOT_FOUND" as const };
      }

      const oldRole = target.role as UserRole;

      if (oldRole === newRole) {
        return { ok: true as const, fromRole: oldRole, toRole: newRole };
      }

      if (oldRole === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
        const [countResult] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(
            and(
              eq(users.role, "SUPER_ADMIN"),
              eq(users.isActive, true),
            ),
          );

        if (countResult.count <= 1) {
          return { ok: false as const, code: "LAST_SUPER_ADMIN" as const };
        }
      }

      await tx
        .update(users)
        .set({ role: newRole, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "USER_ROLE_CHANGED",
        targetType: "user",
        targetId: targetUserId,
        metadata: { fromRole: oldRole, toRole: newRole },
      });

      return { ok: true as const, fromRole: oldRole, toRole: newRole };
    });

    return result;
  } catch {
    return { ok: false, code: "NOT_FOUND" };
  }
}
