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
 */
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobSources } from "@/db/schema/jobSources";
import { sources } from "@/db/schema/sources";
import { auditLog } from "@/db/schema/auditLog";
import { escapeLikePattern } from "@/lib/apiUtils";
import { isStaffRole, type AuthUser } from "@/lib/auth/roles";
import { generateSlug } from "@/lib/ingestion/slug";
import { normalizeTitle } from "@/lib/normalization";
import {
  MANUAL_SOURCE_NAME,
  internalProvenanceUrl,
} from "@/lib/sources/provenance";
import { employerCreateJobSchema } from "@/lib/validations/employerJob";
import type { EmployerCreateJobInput } from "@/lib/validations/employerJob";

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
 *  - job + exactly one job_sources row + audit all committed atomically
 *  - never invents or accepts externalId/sourceId; resolves the Manual
 *    source server-side by its stable name
 *  - always DRAFT + PENDING on creation; publication is left to moderation
 */
export async function createCuratedJob(
  actor: AuthUser,
  input: EmployerCreateJobInput,
): Promise<CuratedJobResult> {
  if (!isStaffRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const parsed = employerCreateJobSchema.safeParse(input);
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
          .returning();

        if (created) {
          createdJob = created;
          break;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("jobs_slug_unique")) {
          continue;
        }
        throw error;
      }
    }

    if (!createdJob) {
      return { ok: false, code: "SLUG_COLLISION" };
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
      },
    });

    return {
      ok: true,
      item: createdJob,
      ...(duplicateWarning ? { warning: duplicateWarning } : {}),
    };
  });
}