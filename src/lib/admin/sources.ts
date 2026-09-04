/**
 * Admin source management helpers (Batch 57).
 *
 * Narrowly-scoped server-side data access for the staff source management
 * workflow. All functions assume the caller has already performed session
 * authentication and role authorization. Identity is never taken from
 * client input.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { auditLog } from "@/db/schema/auditLog";
import { users } from "@/db/schema/users";
import { createSourceSchema, updateSourceSchema } from "@/lib/validations";

export type SourceAdminSummary = {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string | null;
  isActive: boolean;
  trustLevel: string;
  lastSuccessfulCheck: string | null;
  consecutiveFailures: number;
  createdAt: string;
};

export type SourceAdminPaginated = {
  items: SourceAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SourceAuditEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actorEmail: string | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Returns the admin source list: all sources, paginated with optional filters.
 */
export async function listSources(input: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  sourceType?: string;
}): Promise<SourceAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isActive !== undefined) {
    filters.push(eq(sources.isActive, input.isActive));
  }
  if (input.sourceType) {
    filters.push(eq(sources.sourceType, input.sourceType as never));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.sources.findMany({
      where,
      orderBy: [desc(sources.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        isActive: true,
        trustLevel: true,
        lastSuccessfulCheck: true,
        consecutiveFailures: true,
        createdAt: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sources)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceType: r.sourceType,
      baseUrl: r.baseUrl,
      isActive: r.isActive,
      trustLevel: r.trustLevel,
      lastSuccessfulCheck: r.lastSuccessfulCheck ? r.lastSuccessfulCheck.toISOString() : null,
      consecutiveFailures: r.consecutiveFailures,
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Loads a single source's full admin record, or null when not found.
 */
export async function getSource(id: string): Promise<(typeof sources.$inferSelect) | null> {
  if (!isValidUuid(id)) return null;
  const source = await db.query.sources.findFirst({ where: eq(sources.id, id) });
  return source ?? null;
}

/**
 * Creates a new source with audit logging.
 *
 * Returns:
 *   { ok: true, id }  on success
 *   { ok: false, code }  on a controllable failure (validation, duplicate name)
 *   throws  on an unexpected DB error
 */
export async function createSource(
  input: { name: string; sourceType: string; baseUrl?: string | null; isActive?: boolean; trustLevel?: string },
  actorUserId: string,
): Promise<{ ok: true; id: string } | { ok: false; code: "VALIDATION" | "DUPLICATE" }> {
  const parsed = createSourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const data = parsed.data;

  try {
    let sourceId: string = "";
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(sources)
        .values({
          name: data.name,
          sourceType: data.sourceType as never,
          baseUrl: data.baseUrl ?? null,
          isActive: data.isActive ?? true,
          trustLevel: (data.trustLevel ?? "MEDIUM") as never,
        })
        .returning({ id: sources.id });

      sourceId = inserted.id;

      await tx.insert(auditLog).values({
        actorUserId,
        action: "SOURCE_CREATED",
        targetType: "source",
        targetId: inserted.id,
        metadata: {
          name: data.name,
          sourceType: data.sourceType,
        },
      });
    });

    return { ok: true, id: sourceId };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("sources_name_unique")
    ) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

/**
 * Updates an existing source with audit logging.
 *
 * Returns:
 *   { ok: true }  on success
 *   { ok: false, code }  on a controllable failure
 *   throws  on an unexpected DB error
 */
export async function updateSource(
  sourceId: string,
  input: Record<string, unknown>,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "VALIDATION" | "DUPLICATE" }> {
  if (!isValidUuid(sourceId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const parsed = updateSourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }

  const existing = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: true };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sources)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sourceType !== undefined && { sourceType: data.sourceType as never }),
          ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.trustLevel !== undefined && { trustLevel: data.trustLevel as never }),
          updatedAt: new Date(),
        })
        .where(eq(sources.id, sourceId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "SOURCE_UPDATED",
        targetType: "source",
        targetId: sourceId,
        metadata: {
          fields: Object.keys(data),
        },
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("sources_name_unique")
    ) {
      return { ok: false, code: "DUPLICATE" };
    }
    throw err;
  }
}

/**
 * Deletes a source with audit logging.
 *
 * Returns:
 *   { ok: true }  on success
 *   { ok: false, code }  on a controllable failure
 *   throws  on an unexpected DB error
 */
export async function deleteSource(
  sourceId: string,
  actorUserId: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FK_VIOLATION" }> {
  if (!isValidUuid(sourceId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(sources).where(eq(sources.id, sourceId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: "SOURCE_DELETED",
        targetType: "source",
        targetId: sourceId,
        metadata: {
          name: existing.name,
        },
      });
    });

    return { ok: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes("foreign key") || err.message.includes("job_sources"))
    ) {
      return { ok: false, code: "FK_VIOLATION" };
    }
    throw err;
  }
}

/**
 * Toggles a source's isActive flag with audit logging.
 *
 * Returns:
 *   { ok: true, isActive }  on success
 *   { ok: false, code }  on a controllable failure
 *   throws  on an unexpected DB error
 */
export async function toggleSourceActive(
  sourceId: string,
  actorUserId: string,
): Promise<{ ok: true; isActive: boolean } | { ok: false; code: "NOT_FOUND" }> {
  if (!isValidUuid(sourceId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, isActive: true },
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const newIsActive = !existing.isActive;
  const auditEvent = newIsActive ? "SOURCE_ACTIVATED" : "SOURCE_DEACTIVATED";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(sources)
        .set({ isActive: newIsActive, updatedAt: new Date() })
        .where(eq(sources.id, sourceId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: auditEvent,
        targetType: "source",
        targetId: sourceId,
        metadata: {
          fromIsActive: existing.isActive,
          toIsActive: newIsActive,
        },
      });
    });

    return { ok: true, isActive: newIsActive };
  } catch {
    throw new Error("Source toggle failed");
  }
}

/** Reads recent audit events targeting the given source, newest first. */
export async function getSourceAuditHistory(sourceId: string): Promise<SourceAuditEntry[]> {
  if (!isValidUuid(sourceId)) return [];

  const events = await db.query.auditLog.findMany({
    where: and(eq(auditLog.targetType, "source"), eq(auditLog.targetId, sourceId)),
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

  const actorIds = Array.from(new Set(events.map((e) => e.actorUserId).filter(Boolean))) as string[];
  let actorEmails = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const actors = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(actorIds.map((id) => sql`${id}`), sql`, `)})`);
    actorEmails = new Map(actors.map((a) => [a.id, a.email]));
  }

  return events.map((e) => ({
    id: e.id,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    actorEmail: e.actorUserId ? (actorEmails.get(e.actorUserId) ?? null) : null,
  }));
}
