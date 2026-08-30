import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/auditLog";
import { users } from "@/db/schema/users";
import { sanitizeMetadata } from "@/lib/auth/audit";

export type AuditLogEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actorEmail: string | null;
};

export type AuditLogPaginated = {
  items: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const PAGE_SIZE = 50;

export async function listAuditLogs(input: {
  page?: number;
  action?: string;
  targetType?: string;
  actorUserId?: string;
}): Promise<AuditLogPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = PAGE_SIZE;
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.action && input.action.length > 0) {
    filters.push(eq(auditLog.action, input.action));
  }
  if (input.targetType && input.targetType.length > 0) {
    filters.push(eq(auditLog.targetType, input.targetType));
  }
  if (input.actorUserId && input.actorUserId.length > 0) {
    filters.push(eq(auditLog.actorUserId, input.actorUserId));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.auditLog.findMany({
      where,
      orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
      limit,
      offset,
      columns: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (rows.length === 0) {
    return { items: [], page, limit, total, totalPages };
  }

  const actorIds = Array.from(
    new Set(rows.map((r) => r.actorUserId).filter(Boolean)),
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

  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: sanitizeMetadata(
        r.metadata as Record<string, unknown> | null,
      ),
      createdAt: r.createdAt.toISOString(),
      actorEmail: r.actorUserId
        ? actorEmails.get(r.actorUserId) ?? null
        : null,
    })),
    page,
    limit,
    total,
    totalPages,
  };
}
