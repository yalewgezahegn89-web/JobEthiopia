import { db } from "../../db";
import { jobs } from "../../db/schema/jobs";

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
 * Uses bounded slug retries to handle uniqueness conflicts safely.
 *
 * @throws If slug uniqueness cannot be resolved after MAX_SLUG_RETRIES + 1 attempts.
 */
export async function createJobDirect(
  input: CreateJobDirectInput,
  serverContext: CreateJobDirectServerContext,
): Promise<CreateJobDirectResult> {
  const baseSlug = input.slug;

  for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
    const candidateSlug =
      attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

    const [created] = await db
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
      return created as CreateJobDirectResult;
    }
  }

  throw new Error(
    `Could not create job with unique slug after ${MAX_SLUG_RETRIES + 1} attempts`,
  );
}
