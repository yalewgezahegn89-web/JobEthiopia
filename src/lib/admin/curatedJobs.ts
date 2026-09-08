/**
 * Staff-only manual/curated job creation (Phase 6 Batch 1).
 *
 * Creates a job with server-resolved "Manual Entry" source provenance,
 * starting as DRAFT + PENDING so it can flow through the existing
 * moderation/publishing lifecycle.
 *
 * This service MUST be called by a server-side layer that has already
 * authenticated the session and authorized the actor as staff. It does NOT
 * resolve the actor from client input. Identity and role are taken from the
 * caller-provided AuthUser only.
 *
 * Batch 1 scope:
 *  - NO duplicate detection (Batch 3).
 *  - NO publish validation gate (Batch 3). Creation stays DRAFT/PENDING.
 *  - NO schema/UI/auth changes.
 *
 * Batch 3 scope:
 *  - WARN-only duplicate check (same L4 semantics as employer warnings) that
 *    never blocks creation.
 *  - NO publish gate here; publication provenance enforcement lives in
 *    validateJobForPublish() (src/lib/admin/jobs.ts).
 *
 * Phase 6 Step 7 scope (original source provenance):
 *  - OPTIONAL originalSource input preserves the external original vacancy
 *    source (official employer website + vacancy URL + employer reference)
 *    alongside the internal data-entry method. When provided, the service
 *    resolves-or-creates the WEBSITE source record server-side by its stable
 *    name (never from a client id) and writes TWO job_sources edges: the
 *    external edge first (the origin of the listing, so it stays the
 *    representative provenance), then the Manual Entry edge. When omitted the
 *    behaviour is byte-identical to earlier batches (single Manual edge).
 */
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobSources } from "@/db/schema/jobSources";
import { sources } from "@/db/schema/sources";
import { auditLog } from "@/db/schema/auditLog";
import { escapeLikePattern } from "@/lib/apiUtils";
import { isPgUniqueViolation } from "@/lib/pgErrors";
import { isStaffRole, type AuthUser } from "@/lib/auth/roles";
import { generateSlug } from "@/lib/ingestion/slug";
import { normalizeTitle } from "@/lib/normalization";
import {
  MANUAL_SOURCE_NAME,
  internalProvenanceUrl,
} from "@/lib/sources/provenance";
import {
  curatedCreateJobSchema,
  type CuratedCreateJobInput,
} from "@/lib/validations/curatedJob";

const MAX_SLUG_RETRIES = 10;

type JobStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "EXPIRED" | "REMOVED";

/** Existing statuses that can be flagged as a possible duplicate (L4-exact style). */
const DUPLICATE_WARNING_STATUSES: JobStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
];

const DUPLICATE_WARNING_MESSAGE =
  "Possible duplicate — review existing jobs before publishing.";

/**
 * Non-blocking, server-generated warning returned when a manually created job
 * matches an existing job in the same organization on normalized title +
 * location (L4-exact style, same contract as employer warnings).
 */
export type CuratedJobDuplicateWarning = {
  code: "POSSIBLE_DUPLICATE";
  message: string;
  matchedJobId: string;
  matchedJobTitle: string | null;
  matchedStatus: string;
};

export type CuratedJobResult =
  | {
      ok: true;
      item: (typeof jobs.$inferSelect);
      warning?: CuratedJobDuplicateWarning;
    }
  | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "SOURCE_MISSING" | "SLUG_COLLISION" };

/**
 * Creates a curated/manual job with "Manual Entry" source provenance.
 *
 * Authorizes only staff roles (SUPER_ADMIN, ADMIN, MODERATOR) and only via
 * the caller-provided actor; the client can never supply a role, a source,
 * or an actor id.
 *
 * Guarantees:
 *  - idempotent-normal slug generation with bounded collision retries
 *  - job + job_sources provenance + audit all committed atomically
 *  - never accepts a client-supplied sourceId/sourceType; resolves the Manual
 *    source server-side by its stable name
 *  - when originalSource is provided, resolves-or-creates the WEBSITE source
 *    by its stable name and records the external vacancy URL + employer
 *    reference on that edge; the external edge is written first so it remains
 *    the representative provenance (earliest job_sources row)
 *  - always DRAFT + PENDING on creation; publication is left to moderation
 */
export async function createCuratedJob(
  actor: AuthUser,
  input: CuratedCreateJobInput,
): Promise<CuratedJobResult> {
  if (!isStaffRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const parsed = curatedCreateJobSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION" };
  }
  const data = parsed.data;

  return db.transaction(async (tx) => {
    // WARN-only duplicate check (Batch 3). Runs once before the insert so the
    // new job can never match itself, inside the same atomic transaction.
    const normalizedTitle = normalizeTitle(data.title).trim();
    let duplicateWarning: CuratedJobDuplicateWarning | undefined;
    if (normalizedTitle) {
      const locationCondition = data.locationId
        ? eq(jobs.locationId, data.locationId)
        : isNull(jobs.locationId);

      const match = await tx
        .select({ id: jobs.id, title: jobs.title, status: jobs.status })
        .from(jobs)
        .where(
          and(
            eq(jobs.organizationId, data.organizationId),
            ilike(jobs.title, escapeLikePattern(normalizedTitle)),
            locationCondition,
            inArray(jobs.status, DUPLICATE_WARNING_STATUSES),
          ),
        )
        .orderBy(desc(jobs.updatedAt), desc(jobs.createdAt))
        .limit(1);

      if (
        match.length > 0 &&
        DUPLICATE_WARNING_STATUSES.includes(match[0].status as JobStatus)
      ) {
        duplicateWarning = {
          code: "POSSIBLE_DUPLICATE",
          message: DUPLICATE_WARNING_MESSAGE,
          matchedJobId: match[0].id,
          matchedJobTitle: match[0].title,
          matchedStatus: match[0].status,
        };
      }
    }

    const manualSource = await tx
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.name, MANUAL_SOURCE_NAME))
      .limit(1);

    if (manualSource.length === 0) {
      throw new Error("Manual Entry source record not configured");
    }

    const sourceId = manualSource[0].id;
    const sourceUrl = internalProvenanceUrl(sourceId);

    // Phase 6 Step 7: optional external original-source provenance. The source
    // record is resolved-or-created server-side by its stable name (never from
    // a client-supplied id), and the official vacancy URL + employer reference
    // are kept on that edge. baseUrl is derived from the official URL origin.
    const txTimestamp = new Date();
    let originalSourceId: string | null = null;
    if (data.originalSource) {
      const existingSource = await tx
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.name, data.originalSource.sourceName))
        .limit(1);

      if (existingSource.length > 0) {
        originalSourceId = existingSource[0].id;
      } else {
        const [createdSource] = await tx
          .insert(sources)
          .values({
            name: data.originalSource.sourceName,
            sourceType: "WEBSITE",
            baseUrl: sourceBaseUrl(data.originalSource.sourceUrl),
            trustLevel: "HIGH",
          })
          .returning({ id: sources.id });

        originalSourceId = createdSource.id;
      }
    }

    const baseSlug = generateSlug(data.title);
    let createdJob: (typeof jobs.$inferSelect) | null = null;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const candidateSlug =
        attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      try {
        const [created] = await tx
          .insert(jobs)
          .values({
            title: data.title,
            slug: candidateSlug,
            organizationId: data.organizationId,
            categoryId: data.categoryId ?? null,
            professionId: data.professionId ?? null,
            locationId: data.locationId ?? null,
            description: data.description,
            responsibilities: data.responsibilities ?? null,
            requirements: data.requirements ?? null,
            educationRequirements: data.educationRequirements ?? null,
            benefits: data.benefits ?? null,
            experienceMin: data.experienceMin ?? null,
            experienceMax: data.experienceMax ?? null,
            employmentType: (data.employmentType as never) ?? null,
            salaryMin: data.salaryMin != null ? String(data.salaryMin) : null,
            salaryMax: data.salaryMax != null ? String(data.salaryMax) : null,
            salaryCurrency: data.salaryCurrency ?? null,
            salaryPeriod: (data.salaryPeriod as never) ?? null,
            postedAt: data.postedAt ? new Date(data.postedAt) : null,
            deadline: data.deadline ? new Date(data.deadline) : null,
            applicationUrl: data.applicationUrl ?? null,
            status: "DRAFT",
            verificationStatus: "PENDING",
          })
          // A slug collision must not abort the whole transaction: PostgreSQL
          // marks a transaction aborted after any failed statement, so an
          // exception-based retry inside the same transaction can never work
          // on real Postgres (every later statement fails with 25P02). Using
          // ON CONFLICT DO NOTHING yields zero rows on collision without
          // throwing, so the retry loop below simply continues to `-1`, `-2`,
          // ... exactly as the disabled (exception) path intended.
          .onConflictDoNothing({ target: jobs.slug })
          .returning();

        if (created) {
          createdJob = created;
          break;
        }
      } catch (error: unknown) {
        // Defensive only: on PostgreSQL the ON CONFLICT guard above prevents
        // unique violations from surfacing. Keep the constraint check for
        // non-PostgreSQL backends / legacy drivers where the error may carry
        // the constraint name on `message` or on the `cause` chain.
        if (isPgUniqueViolation(error, "jobs_slug_unique")) {
          continue;
        }
        throw error;
      }
    }

    if (!createdJob) {
      return { ok: false, code: "SLUG_COLLISION" };
    }

    if (originalSourceId && data.originalSource) {
      await tx.insert(jobSources).values({
        jobId: createdJob.id,
        sourceId: originalSourceId,
        sourceUrl: data.originalSource.sourceUrl,
        externalId: data.originalSource.externalId ?? null,
        rawHash: null,
        lastSeenAt: null,
        // Both edges are written in the same transaction and would otherwise
        // share the transaction timestamp. Pin the external edge one
        // millisecond earlier so it is deterministically the "earliest"
        // job_sources row (the representative provenance in moderation).
        createdAt: new Date(txTimestamp.getTime() - 1),
      })
        // The (source, externalId) pair is globally unique: one official
        // vacancy reference belongs to one canonical job. A duplicate/workflow
        // re-entry claiming the same reference must NOT abort creation (the
        // warn-only duplicate contract). When the external edge already exists
        // on another job, this new job simply falls back to Manual-entry-only
        // provenance and the admin is alerted via the duplicate warning.
        .onConflictDoNothing();
    }

    await tx.insert(jobSources).values({
      jobId: createdJob.id,
      sourceId,
      sourceUrl,
      externalId: null,
      rawHash: null,
      lastSeenAt: null,
    });

    await tx.insert(auditLog).values({
      actorUserId: actor.id,
      action: "JOB_CREATED",
      targetType: "job",
      targetId: createdJob.id,
      metadata: {
        source: "manual",
        sourceId,
        organizationId: createdJob.organizationId,
        ...(data.originalSource
          ? {
              originalSource: {
                sourceName: data.originalSource.sourceName,
                sourceUrl: data.originalSource.sourceUrl,
                externalId: data.originalSource.externalId ?? null,
              },
              originalSourceId,
            }
          : {}),
      },
    });

    return {
      ok: true,
      item: createdJob,
      ...(duplicateWarning ? { warning: duplicateWarning } : {}),
    };
  });
}

/** Derives a source base URL from an official vacancy URL (origin only). */
function sourceBaseUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}