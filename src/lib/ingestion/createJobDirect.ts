import { eq } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema/jobs";
import { jobSources } from "../../db/schema/jobSources";
import { sources } from "../../db/schema/sources";
import {
  API_KEY_SOURCE_NAME,
  internalProvenanceUrl,
} from "../sources/provenance";

const MAX_SLUG_RETRIES = 10;

export interface CreateJobDirectInput {
  title: string;
  slug: string;
  categoryId?: string | null;
  professionId?: string | null;
  locationId?: string | null;
  description: string;
  responsibilities?: string | null;
  requirements?: string | null;
  educationRequirements?: string | null;
  benefits?: string | null;
  experienceMin?: number | null;
  experienceMax?: number | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  postedAt?: string | null;
  deadline?: string | null;
  applicationUrl?: string | null;
}

/**
 * Server-resolved, trusted context for direct job creation.
 * Callers can never supply these from the request body.
 */
export interface CreateJobDirectServerContext {
  organizationId: string;
}

export interface CreateJobDirectResult {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  categoryId: string | null;
  professionId: string | null;
  locationId: string | null;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  employmentType: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  applicationUrl: string | null;
  status: string;
  verificationStatus: string;
  firstSeenAt: Date;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a job directly from validated input without ingestion pipeline.
 *
 * Does NOT perform:
 * - Normalization
 * - Deduplication
 * - Entity name resolution
 *
 * The job insert and its job_sources provenance row are written atomically
 * inside a single transaction. The API source record is resolved
 * server-side by name; callers can never influence sourceId/sourceType.
 *
 * Uses bounded slug retries to handle uniqueness conflicts safely.
 *
 * @throws If the API source record is not configured, or if slug uniqueness
 * cannot be resolved after MAX_SLUG_RETRIES + 1 attempts.
 */
export async function createJobDirect(
  input: CreateJobDirectInput,
  serverContext: CreateJobDirectServerContext,
): Promise<CreateJobDirectResult> {
  return db.transaction(async (tx) => {
    const sourceRow = await tx
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.name, API_KEY_SOURCE_NAME))
      .limit(1);

    if (sourceRow.length === 0) {
      throw new Error("API source record not configured");
    }

    const sourceId = sourceRow[0].id;
    const sourceUrl = internalProvenanceUrl(sourceId);

    const baseSlug = input.slug;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const candidateSlug =
        attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

      const [created] = await tx
        .insert(jobs)
        .values({
          title: input.title,
          slug: candidateSlug,
          organizationId: serverContext.organizationId,
          categoryId: input.categoryId ?? null,
          professionId: input.professionId ?? null,
          locationId: input.locationId ?? null,
          description: input.description,
          responsibilities: input.responsibilities ?? null,
          requirements: input.requirements ?? null,
          educationRequirements: input.educationRequirements ?? null,
          benefits: input.benefits ?? null,
          experienceMin: input.experienceMin ?? null,
          experienceMax: input.experienceMax ?? null,
          employmentType: (input.employmentType as never) ?? null,
          salaryMin: input.salaryMin != null ? String(input.salaryMin) : null,
          salaryMax: input.salaryMax != null ? String(input.salaryMax) : null,
          salaryCurrency: input.salaryCurrency ?? null,
          salaryPeriod: (input.salaryPeriod as never) ?? null,
          postedAt: input.postedAt ? new Date(input.postedAt) : null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          applicationUrl: input.applicationUrl ?? null,
          status: "DRAFT" as never,
          verificationStatus: "PENDING" as never,
        })
        .returning();

      if (created) {
        await tx.insert(jobSources).values({
          jobId: created.id,
          sourceId,
          sourceUrl,
          externalId: null,
          rawHash: null,
          lastSeenAt: null,
        });

        return created as CreateJobDirectResult;
      }
    }

    throw new Error(
      `Could not create job with unique slug after ${MAX_SLUG_RETRIES + 1} attempts`,
    );
  });
}
