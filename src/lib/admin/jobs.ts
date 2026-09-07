/**
 * Admin job moderation helpers (Batch 51).
 *
 * Narrowly-scoped server-side data access for the staff moderation workflow.
 * All functions assume the caller has already performed session authentication
 * and role authorization. Identity is never taken from client input.
 */
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobSources } from "@/db/schema/jobSources";
import { sources } from "@/db/schema/sources";
import { auditLog } from "@/db/schema/auditLog";
import { users } from "@/db/schema/users";
import { organizations } from "@/db/schema/organizations";
import { categories } from "@/db/schema/categories";
import { locations } from "@/db/schema/locations";

// ---------------------------------------------------------------------------
// Publish validation gate (Phase 5B)
// ---------------------------------------------------------------------------

export type PublishValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: "INCOMPLETE_DATA";
      missingFields: string[];
      message: string;
    };

type JobRow = typeof jobs.$inferSelect;

/**
 * Validates that a job meets all publication requirements.
 *
 * Checks:
 *  - title is non-empty after trim
 *  - description is non-empty after trim and >= 50 characters
 *  - organizationId exists, organization exists and is ACTIVE
 *  - categoryId exists, category exists and isActive
 *  - locationId exists, location exists and isActive
 *  - employmentType is non-null
 *  - if deadline is non-null, it must be >= now
 *
 * Does NOT check status transitions — callers must verify that separately.
 */
export async function validateJobForPublish(
  job: JobRow,
): Promise<PublishValidationResult> {
  const missingFields: string[] = [];

  // --- title ---
  const title = (job.title ?? "").trim();
  if (title.length === 0) {
    missingFields.push("title");
  }

  // --- description ---
  const description = (job.description ?? "").trim();
  if (description.length === 0) {
    missingFields.push("description");
  } else if (description.length < 50) {
    missingFields.push("description");
  }

  // --- organization ---
  if (!job.organizationId) {
    missingFields.push("organizationId");
  } else {
    const org = await db.query.organizations.findFirst({
      columns: { id: true, status: true },
      where: eq(organizations.id, job.organizationId),
    });
    if (!org) {
      missingFields.push("organizationId");
    } else if (org.status !== "ACTIVE") {
      missingFields.push("organizationId");
    }
  }

  // --- category ---
  if (!job.categoryId) {
    missingFields.push("categoryId");
  } else {
    const cat = await db.query.categories.findFirst({
      columns: { id: true, isActive: true },
      where: eq(categories.id, job.categoryId),
    });
    if (!cat) {
      missingFields.push("categoryId");
    } else if (!cat.isActive) {
      missingFields.push("categoryId");
    }
  }

  // --- location ---
  if (!job.locationId) {
    missingFields.push("locationId");
  } else {
    const loc = await db.query.locations.findFirst({
      columns: { id: true, isActive: true },
      where: eq(locations.id, job.locationId),
    });
    if (!loc) {
      missingFields.push("locationId");
    } else if (!loc.isActive) {
      missingFields.push("locationId");
    }
  }

  // --- employmentType ---
  if (!job.employmentType) {
    missingFields.push("employmentType");
  }

  // --- deadline ---
  if (job.deadline) {
    const now = new Date();
    if (job.deadline < now) {
      missingFields.push("deadline");
    }
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      code: "INCOMPLETE_DATA",
      missingFields,
      message: `Job is not ready for publication: missing or invalid ${missingFields.join(", ")}`,
    };
  }

  return { ok: true };
}

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
  | "REQUEST_REVIEW"
  | "REVERIFY";

export type ModerationState = {
  fromStatus: string;
  toStatus: string;
  fromVerificationStatus: string;
  toVerificationStatus: string;
};

/**
 * Provenance of a job listing as recorded on job_sources.
 *
 * rawHash is deliberately NOT exposed here: it is a dedup artifact only.
 * A null/absent value means the job has no recorded source (e.g. it was
 * created directly by API key or by the employer CLI/portal).
 */
export type JobProvenance = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  externalId: string | null;
  firstSeenAt: string;
  lastSeenAt: string | null;
  trustLevel: string;
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
  sourceType: string | null;
  sourceUrl: string | null;
  externalId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  trustLevel: string | null;
};

export type ModerationJobDetail = JobRow & {
  provenance: JobProvenance | null;
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
 * Fetches provenance for a set of job ids in two indexed lookups (no N+1).
 *
 * When a job has multiple job_sources rows (it was observed from several
 * sources), the representative provenance is deterministically the
 * EARLIEST-created row: the ingestion flow creates the primary job_source
 * with the job itself (upsertJob) and add-only createJobSource edges link
 * additional sources afterwards. Ties are broken by id for stability.
 */
async function resolveJobProvenance(
  jobIds: string[],
): Promise<Map<string, JobProvenance>> {
  if (jobIds.length === 0) return new Map();

  const sourceRows = await db.query.jobSources.findMany({
    where: inArray(jobSources.jobId, jobIds),
    columns: {
      id: true,
      jobId: true,
      sourceId: true,
      sourceUrl: true,
      externalId: true,
      firstSeenAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  if (sourceRows.length === 0) return new Map();

  const sourceIds = Array.from(new Set(sourceRows.map((r) => r.sourceId)));
  let sourceLookup = new Map<
    string,
    { name: string; sourceType: string; trustLevel: string }
  >();
  if (sourceIds.length > 0) {
    const found = await db.query.sources.findMany({
      where: inArray(sources.id, sourceIds),
      columns: { id: true, name: true, sourceType: true, trustLevel: true },
    });
    sourceLookup = new Map(found.map((s) => [s.id, s]));
  }

  const ordered = [...sourceRows].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );

  const byJob = new Map<string, JobProvenance>();
  for (const row of ordered) {
    if (byJob.has(row.jobId)) continue;
    const source = sourceLookup.get(row.sourceId);
    if (!source) continue;
    byJob.set(row.jobId, {
      sourceId: row.sourceId,
      sourceName: source.name,
      sourceType: source.sourceType,
      sourceUrl: row.sourceUrl,
      externalId: row.externalId,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
      trustLevel: source.trustLevel,
    });
  }

  return byJob;
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

  const provenanceById = await resolveJobProvenance(rows.map((r) => r.id));

  const items: ModerationJobSummary[] = rows.map((r) => {
    const provenance = provenanceById.get(r.id);
    return {
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
      sourceName: provenance?.sourceName ?? null,
      sourceType: provenance?.sourceType ?? null,
      sourceUrl: provenance?.sourceUrl ?? null,
      externalId: provenance?.externalId ?? null,
      firstSeenAt: provenance?.firstSeenAt ?? null,
      lastSeenAt: provenance?.lastSeenAt ?? null,
      trustLevel: provenance?.trustLevel ?? null,
    };
  });

  const total = totalRows[0]?.count ?? 0;
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Loads a single job's full moderation record (with provenance), or null when not found. */
export async function getModerationJob(id: string): Promise<ModerationJobDetail | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, id) });
  if (!job) return null;
  const provenance = await resolveJobProvenance([job.id]);
  return { ...job, provenance: provenance.get(job.id) ?? null };
}

/**
 * Applies the named moderation action to the given job.
 *
 * Returns:
 *   { ok: true, state }  on success (audit row written, job updated)
 *   { ok: false, code }  on a controllable failure (job missing, invalid action,
 *                        forbidden transition, already final, incomplete data)
 *   throws               on an unexpected DB error (caller maps to generic error)
 *
 * The job update and the audit insert happen atomically in a single transaction.
 */
export async function moderateJob(
  jobId: string,
  action: ModerationAction,
  actorUserId: string,
): Promise<
  { ok: true; state: ModerationState } | { ok: false; code: "NOT_FOUND" | "INVALID_ACTION" | "FORBIDDEN" | "INCOMPLETE_DATA" }
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

  if (action === "PUBLISH") {
    const validation = await validateJobForPublish(job);
    if (!validation.ok) {
      return { ok: false, code: validation.code };
    }
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

      const auditMetadata: Record<string, unknown> = {
        fromStatus: plan.fromStatus,
        toStatus: plan.toStatus,
        fromVerificationStatus: plan.fromVerificationStatus,
        toVerificationStatus: plan.toVerificationStatus,
      };

      if (plan.event === "JOB_REVERIFIED") {
        auditMetadata.fromLastVerifiedAt = job.lastVerifiedAt?.toISOString() ?? null;
        auditMetadata.toLastVerifiedAt = now.toISOString();
      }

      await tx.insert(auditLog).values({
        actorUserId,
        action: plan.event,
        targetType: "job",
        targetId: jobId,
        metadata: auditMetadata,
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
    case "REVERIFY":
      if (fromStatus !== "PUBLISHED") return null;
      return {
        fromStatus,
        toStatus: "PUBLISHED",
        fromVerificationStatus,
        toVerificationStatus: "VERIFIED",
        event: "JOB_REVERIFIED",
        verified: true,
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
