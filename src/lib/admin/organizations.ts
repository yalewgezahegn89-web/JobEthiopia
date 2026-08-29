/**
 * Admin organization verification helpers (Batch 53).
 *
 * Narrowly-scoped server-side data access for the staff organization
 * verification workflow. All functions assume the caller has already
 * performed session authentication and role authorization. Identity is
 * never taken from client input.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { auditLog } from "@/db/schema/auditLog";
import { users } from "@/db/schema/users";

export type OrganizationVerificationAction =
  | "VERIFY"
  | "REJECT"
  | "REQUEST_REVIEW";

export type OrganizationAdminSummary = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

export type OrganizationAdminPaginated = {
  items: OrganizationAdminSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type OrganizationAuditEntry = {
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
 * Returns the organization admin list: all organizations, paginated.
 */
export async function listOrganizations(input: {
  page?: number;
  limit?: number;
  isVerified?: boolean;
}): Promise<OrganizationAdminPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const filters: ReturnType<typeof eq>[] = [];
  if (input.isVerified !== undefined) {
    filters.push(eq(organizations.isVerified, input.isVerified));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.query.organizations.findMany({
      where,
      orderBy: [desc(organizations.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        status: true,
        isVerified: true,
        verifiedAt: true,
        createdAt: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      industry: r.industry,
      status: r.status,
      isVerified: r.isVerified,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Loads a single organization's full admin record, or null when not found.
 */
export async function getOrganization(id: string): Promise<(typeof organizations.$inferSelect) | null> {
  if (!isValidUuid(id)) return null;
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, id) });
  return org ?? null;
}

/**
 * Applies a verification action to the given organization.
 *
 * Returns:
 *   { ok: true }  on success (audit row written, org updated)
 *   { ok: false, code }  on a controllable failure
 *   throws  on an unexpected DB error (caller maps to generic error)
 *
 * The org update and audit insert happen atomically in a single transaction.
 */
export async function verifyOrganization(
  orgId: string,
  action: OrganizationVerificationAction,
  actorUserId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "INVALID_STATE" }> {
  if (!isValidUuid(orgId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { id: true, isVerified: true },
  });
  if (!org) return { ok: false, code: "NOT_FOUND" };

  const plan = planVerificationAction(org.isVerified, action);
  if (!plan) {
    return { ok: false, code: "INVALID_STATE" };
  }

  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(organizations)
        .set(plan.setFields(now, actorUserId, reason))
        .where(
          and(
            eq(organizations.id, orgId),
            eq(organizations.isVerified, plan.fromIsVerified),
          ),
        )
        .returning({ id: organizations.id });

      if (updated) {
        await tx.insert(auditLog).values({
          actorUserId,
          action: plan.event,
          targetType: "organization",
          targetId: orgId,
          metadata: plan.metadata(reason),
        });
      }
    });
  } catch {
    throw new Error("Organization verification update failed");
  }

  return { ok: true };
}

type VerificationPlan = {
  fromIsVerified: boolean;
  event: string;
  setFields: (now: Date, actorUserId: string, reason?: string) => Record<string, unknown>;
  metadata: (reason?: string) => Record<string, unknown>;
};

function planVerificationAction(
  currentIsVerified: boolean,
  action: OrganizationVerificationAction,
): VerificationPlan | null {
  switch (action) {
    case "VERIFY":
      if (currentIsVerified) return null;
      return {
        fromIsVerified: false,
        event: "ORGANIZATION_VERIFIED",
        setFields: (now, actorUserId) => ({
          isVerified: true,
          verifiedAt: now,
          verifiedBy: actorUserId,
          verificationNotes: null,
        }),
        metadata: () => ({
          fromStatus: "UNVERIFIED",
          toStatus: "VERIFIED",
        }),
      };
    case "REJECT":
      if (!currentIsVerified) return null;
      return {
        fromIsVerified: true,
        event: "ORGANIZATION_REJECTED",
        setFields: (_now, _actorUserId, reason) => ({
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          verificationNotes: reason ?? null,
        }),
        metadata: (reason) => ({
          fromStatus: "VERIFIED",
          toStatus: "UNVERIFIED",
          reason: reason ?? null,
        }),
      };
    case "REQUEST_REVIEW":
      if (!currentIsVerified) return null;
      return {
        fromIsVerified: true,
        event: "ORGANIZATION_REVIEW_REQUESTED",
        setFields: (_now, _actorUserId, reason) => ({
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          verificationNotes: reason ?? null,
        }),
        metadata: (reason) => ({
          fromStatus: "VERIFIED",
          toStatus: "UNVERIFIED",
          reason: reason ?? null,
        }),
      };
    default:
      return null;
  }
}

/** Reads recent audit events targeting the given organization, newest first. */
export async function getOrganizationAuditHistory(orgId: string): Promise<OrganizationAuditEntry[]> {
  if (!isValidUuid(orgId)) return [];

  const events = await db.query.auditLog.findMany({
    where: and(eq(auditLog.targetType, "organization"), eq(auditLog.targetId, orgId)),
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
  let actorEmails = new Map<string, string>();
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
