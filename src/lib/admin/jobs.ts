/**
 * Admin job moderation helpers (Batch 51).
 *
 * Narrowly-scoped server-side data access for the staff moderation workflow.
 * All functions assume the caller has already performed session authentication
 * and role authorization. Identity is never taken from client input.
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { auditLog } from "@/db/schema/auditLog";
import { users } from "@/db/schema/users";

/** The single authoritative lifecycle transition table (mirrors the existing job route). */
export const VALID_STATUS_TRANSITIONS: Record<
  "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED",
  string[]
> = {
  DRAFT: ["PENDING_REVIEW", "PUBLISHED", "REMOVED"],
  PENDING_REVIEW: ["DRAFT", "PUBLISHED", "REMOVED"],
  PUBLISHED: ["EXPIRED", "REMOVED"],
  EXPIRED: ["REMOVED"],
  REMOVED: [],
};

export type ModerationAction =
  | "PUBLISH"
  | "REJECT"
  | "MARK_INVALID"
  | "REQUEST_REVIEW";

export type ModerationState = {
  fromStatus: string;
  toStatus: string;
  fromVerificationStatus: string;
  toVerificationStatus: string;
};

export type ModerationJobSummary = {
  id: string;
  title: string;
  slug: string;
  status: string;
  verificationStatus: string;
  postedAt: string | null;
  deadline: string | null;
  lastVerifiedAt: string | null;
  organizationName: string | null;
  categoryName: string | null;
  professionName: string | null;
  locationName: string | null;
  sourceName: string | null;
};

export type ModerationJobPaginated = {
  items: ModerationJobSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type JobAuditEntry = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actorEmail: string | null;
};

const ENTITY_COLUMNS = ["id", "name"] as const;

async function entityNames(
  type: "organizations" | "categories" | "professions" | "locations",
): Promise<Map<string, string>> {
  const table = (db.query as unknown as Record<string, { findMany: (a: object) => Promise<{ id: string; name: string }[]> }>)[type];
  const rows = await table.findMany({ columns: { ...ENTITY_COLUMNS } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Returns the moderation queue: jobs that are PENDING_REVIEW by lifecycle or
 * NEEDS_REVIEW by verification. A job satisfying both conditions appears once.
 */
export async function listModerationJobs(input: {
  page?: number;
  limit?: number;
  status?: string;
  verificationStatus?: string;
}): Promise<ModerationJobPaginated> {
  const page = Math.max(1, Number.isFinite(input.page) ? Math.trunc(input.page ?? 1) : 1);
  const limit = Math.min(100, Math.max(1, Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 20) : 20));
  const offset = (page - 1) * limit;

  const baseCondition = or(
    eq(jobs.status, "PENDING_REVIEW"),
    eq(jobs.verificationStatus, "NEEDS_REVIEW"),
  );

  const filters = [baseCondition];
  if (input.status) filters.push(eq(jobs.status, input.status as never));
  if (input.verificationStatus) {
    filters.push(eq(jobs.verificationStatus, input.verificationStatus as never));
  }
  const where = and(...filters);

  const [rows, totalRows] = await Promise.all([
    db.query.jobs.findMany({
      where,
      orderBy: [desc(jobs.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        title: true,
        slug: true,
        status: true,
        verificationStatus: true,
        postedAt: true,
        deadline: true,
        lastVerifiedAt: true,
        organizationId: true,
        categoryId: true,
        professionId: true,
        locationId: true,
      },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(where),
  ]);

  const [organizations, categories, professions, locations] = await Promise.all([
    entityNames("organizations"),
    entityNames("categories"),
    entityNames("professions"),
    entityNames("locations"),
  ]);

  const items: ModerationJobSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    verificationStatus: r.verificationStatus,
    postedAt: r.postedAt ? r.postedAt.toISOString() : null,
    deadline: r.deadline ? r.deadline.toISOString() : null,
    lastVerifiedAt: r.lastVerifiedAt ? r.lastVerifiedAt.toISOString() : null,
    organizationName: r.organizationId ? (organizations.get(r.organizationId) ?? null) : null,
    categoryName: r.categoryId ? (categories.get(r.categoryId) ?? null) : null,
    professionName: r.professionId ? (professions.get(r.professionId) ?? null) : null,
    locationName: r.locationId ? (locations.get(r.locationId) ?? null) : null,
    sourceName: null,
  }));

  const total = totalRows[0]?.count ?? 0;
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Loads a single job's full moderation record, or null when not found. */
export async function getModerationJob(id: string): Promise<(typeof jobs.$inferSelect) | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
  return job ?? null;
}

/**
 * Applies the named moderation action to the given job.
 *
 * Returns:
 *   { ok: true, state }  on success (audit row written, job updated)
 *   { ok: false, code }  on a controllable failure (job missing, invalid action,
 *                        forbidden transition, already final)
 *   throws               on an unexpected DB error (caller maps to generic error)
 *
 * The job update and the audit insert happen atomically in a single transaction.
 */
export async function moderateJob(
  jobId: string,
  action: ModerationAction,
  actorUserId: string,
): Promise<
  { ok: true; state: ModerationState } | { ok: false; code: "NOT_FOUND" | "INVALID_ACTION" | "FORBIDDEN" }
> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return { ok: false, code: "NOT_FOUND" };

  const plan = planAction(job.status, job.verificationStatus, action);
  if (!plan) {
    return { ok: false, code: "FORBIDDEN" };
  }

  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(jobs)
        .set({
          status: plan.toStatus as never,
          verificationStatus: plan.toVerificationStatus as never,
          lastVerifiedAt: plan.verified ? now : job.lastVerifiedAt,
          updatedAt: now,
        })
        .where(eq(jobs.id, jobId));

      await tx.insert(auditLog).values({
        actorUserId,
        action: plan.event,
        targetType: "job",
        targetId: jobId,
        metadata: {
          fromStatus: plan.fromStatus,
          toStatus: plan.toStatus,
          fromVerificationStatus: plan.fromVerificationStatus,
          toVerificationStatus: plan.toVerificationStatus,
        },
      });
    });
  } catch {
    throw new Error("Moderation update failed");
  }

  return {
    ok: true,
    state: {
      fromStatus: plan.fromStatus,
      toStatus: plan.toStatus,
      fromVerificationStatus: plan.fromVerificationStatus,
      toVerificationStatus: plan.toVerificationStatus,
    },
  };
}

type JobStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED";
type VerStatus = "PENDING" | "VERIFIED" | "NEEDS_REVIEW" | "INVALID";

function planAction(
  status: string,
  verification: string,
  action: ModerationAction,
): (ModerationState & { event: string; verified: boolean }) | null {
  const fromStatus = status as JobStatus;
  const fromVerificationStatus = verification as VerStatus;

  switch (action) {
    case "PUBLISH":
      if (fromStatus === "REMOVED") return null;
      if (!VALID_STATUS_TRANSITIONS[fromStatus].includes("PUBLISHED")) return null;
      return {
        fromStatus,
        toStatus: "PUBLISHED",
        fromVerificationStatus,
        toVerificationStatus: "VERIFIED",
        event: "JOB_PUBLISHED",
        verified: true,
      };
    case "REJECT":
      if (fromStatus === "REMOVED") return null;
      if (!VALID_STATUS_TRANSITIONS[fromStatus].includes("REMOVED")) return null;
      return {
        fromStatus,
        toStatus: "REMOVED",
        fromVerificationStatus,
        toVerificationStatus: verification,
        event: "JOB_REJECTED",
        verified: false,
      };
    case "MARK_INVALID":
      return {
        fromStatus,
        toStatus: status,
        fromVerificationStatus,
        toVerificationStatus: "INVALID",
        event: "JOB_MARKED_INVALID",
        verified: false,
      };
    case "REQUEST_REVIEW":
      return {
        fromStatus,
        toStatus: status,
        fromVerificationStatus,
        toVerificationStatus: "NEEDS_REVIEW",
        event: "JOB_REVIEW_REQUESTED",
        verified: false,
      };
    default:
      return null;
  }
}

/** Reads recent audit events targeting the given job, newest first (no N+1). */
export async function getJobAuditHistory(jobId: string): Promise<JobAuditEntry[]> {
  const events = await db.query.auditLog.findMany({
    where: and(eq(auditLog.targetType, "job"), eq(auditLog.targetId, jobId)),
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
