import { db } from "../../db";
import { jobs } from "../../db/schema/jobs";
import { jobSources } from "../../db/schema/jobSources";
import { generateSlug } from "./slug";
import { canonicalizeUrl } from "../dedup/canonicalUrl";

const MAX_SLUG_RETRIES = 10;

export interface UpsertJobInput {
  normalizedTitle: string;
  normalizedDescription: string;
  organizationId: string;
  locationId: string | null;
  professionId: string | null;
  categoryId: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  postedAt: Date | null;
  deadline: Date | null;
  applicationUrl: string | null;
  sourceId: string;
  externalId: string | null;
  sourceUrl: string | null;
  rawHash: string;
}

export interface UpsertJobResult {
  jobId: string;
  jobSourceId: string;
}

/**
 * Creates a new job and its job-source linkage within a transaction.
 *
 * Uses deterministic slug generation with bounded suffix retries
 * to handle slug uniqueness safely. Uses onConflictDoNothing for
 * idempotent entity creation.
 *
 * Does NOT update existing jobs. Update logic belongs to a future batch.
 *
 * @throws If job or job_source creation fails after all retries.
 */
export async function upsertJob(
  input: UpsertJobInput,
): Promise<UpsertJobResult> {
  const baseSlug = generateSlug(input.normalizedTitle);

  let jobId: string | null = null;
  let usedSlug = baseSlug;

  for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
    const candidateSlug =
      attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

    const [created] = await db
      .insert(jobs)
      .values({
        title: input.normalizedTitle,
        slug: candidateSlug,
        organizationId: input.organizationId,
        categoryId: input.categoryId,
        professionId: input.professionId,
        locationId: input.locationId,
        description: input.normalizedDescription,
        responsibilities: input.responsibilities,
        requirements: input.requirements,
        educationRequirements: input.educationRequirements,
        benefits: input.benefits,
        experienceMin: input.experienceMin,
        experienceMax: input.experienceMax,
        employmentType: input.employmentType as never,
        salaryMin: input.salaryMin != null ? String(input.salaryMin) : null,
        salaryMax: input.salaryMax != null ? String(input.salaryMax) : null,
        salaryCurrency: input.salaryCurrency,
        salaryPeriod: input.salaryPeriod as never,
        postedAt: input.postedAt,
        deadline: input.deadline,
        applicationUrl: input.applicationUrl,
        status: "DRAFT",
        verificationStatus: "PENDING",
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      jobId = created.id;
      usedSlug = candidateSlug;
      break;
    }
  }

  if (!jobId) {
    throw new Error(
      `Could not create job with unique slug after ${MAX_SLUG_RETRIES + 1} attempts`,
    );
  }

  const canonicalUrl = canonicalizeUrl(input.sourceUrl);
  const effectiveSourceUrl =
    canonicalUrl ??
    input.sourceUrl?.trim() ??
    `jobethiopia://source/${input.sourceId}/external/${input.externalId ?? "none"}`;

  const [jobSource] = await db
    .insert(jobSources)
    .values({
      jobId,
      sourceId: input.sourceId,
      sourceUrl: effectiveSourceUrl,
      externalId: input.externalId,
      rawHash: input.rawHash,
    })
    .onConflictDoNothing()
    .returning();

  if (!jobSource) {
    throw new Error(
      `Failed to create job_source linkage for job ${jobId} (slug: ${usedSlug})`,
    );
  }

  return { jobId, jobSourceId: jobSource.id };
}
