import {
  normalizeTitle,
  normalizeOrganization,
  normalizeDescription,
  normalizeEmploymentType,
  normalizeSalary,
  normalizeExperience,
} from "../normalization";
import { computeContentHash } from "../normalization/hash";
import { detectDuplicate } from "../dedup";
import {
  resolveOrganization,
  resolveLocation,
  resolveProfession,
  resolveCategory,
} from "./resolveEntities";
import { upsertJob } from "./upsertJob";
import type { RawJobInput, IngestionResult } from "./types";

/**
 * Ingests a raw job listing into the JobEthiopia database.
 *
 * This is a **write service** that:
 * - normalizes raw input using Batch 1 utilities
 * - resolves entities (organization, location, profession, category)
 * - computes a content hash for duplicate detection
 * - detects duplicates using the four-level cascade from Batch 2
 * - creates the job and job-source linkage if the listing is unique
 *
 * This function must NOT:
 * - publish jobs (status remains DRAFT)
 * - fetch external websites
 * - send emails
 * - modify source health fields (lastSuccessfulCheck, etc.)
 * - schedule work
 * - expose API endpoints
 *
 * @param input - Raw job data from an external source
 * @returns IngestionResult indicating CREATED, DUPLICATE, or POSSIBLE_DUPLICATE
 * @throws Database errors propagate to the caller without being swallowed
 */
export async function ingestJob(
  input: RawJobInput,
): Promise<IngestionResult> {
  // 1. Normalize raw input
  const normalizedTitle = normalizeTitle(input.title);
  const normalizedOrgName = normalizeOrganization(input.organizationName);
  const normalizedDescription = normalizeDescription(input.description);
  const normalizedEmploymentType = normalizeEmploymentType(
    input.employmentType ?? null,
  );
  const normalizedSalary = normalizeSalary(input.salaryRaw ?? null);
  const normalizedExperience = normalizeExperience(input.experienceRaw ?? null);

  const postedAt = input.postedAt ? new Date(input.postedAt) : null;
  const deadline = input.deadline ? new Date(input.deadline) : null;

  // 2. Resolve entities
  const organizationId = await resolveOrganization(normalizedOrgName);
  const locationId = input.locationName
    ? await resolveLocation(input.locationName)
    : null;
  const professionId = input.professionName
    ? await resolveProfession(input.professionName)
    : null;
  const categoryId = input.categoryName
    ? await resolveCategory(input.categoryName)
    : null;

  // 3. Compute content hash
  const rawHash = computeContentHash({
    normalizedTitle,
    organizationId,
    locationId: locationId ?? "",
    normalizedDescription,
    deadline: deadline?.toISOString() ?? "",
    applicationUrl: input.applicationUrl ?? "",
  });

  // 4. Detect duplicate
  const duplicateResult = await detectDuplicate({
    sourceId: input.sourceId,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl,
    rawHash,
    organizationId,
    normalizedTitle,
    locationId,
  });

  // 5. Handle duplicate
  if (duplicateResult.classification === "DUPLICATE") {
    return {
      outcome: "DUPLICATE",
      jobId: null,
      jobSourceId: null,
      matchedJobId: duplicateResult.matchedJobId,
      matchedJobSourceId: duplicateResult.matchedJobSourceId,
      duplicateLevel: duplicateResult.level,
      duplicateConfidence: duplicateResult.confidence,
      duplicateReason: duplicateResult.reason,
    };
  }

  if (duplicateResult.classification === "POSSIBLE_DUPLICATE") {
    return {
      outcome: "POSSIBLE_DUPLICATE",
      jobId: null,
      jobSourceId: null,
      matchedJobId: duplicateResult.matchedJobId,
      matchedJobSourceId: duplicateResult.matchedJobSourceId,
      duplicateLevel: duplicateResult.level,
      duplicateConfidence: duplicateResult.confidence,
      duplicateReason: duplicateResult.reason,
    };
  }

  // 6. UNIQUE — create job and job-source linkage
  const { jobId, jobSourceId } = await upsertJob({
    normalizedTitle,
    normalizedDescription,
    organizationId,
    locationId,
    professionId,
    categoryId,
    employmentType: normalizedEmploymentType,
    salaryMin: normalizedSalary.salaryMin,
    salaryMax: normalizedSalary.salaryMax,
    salaryCurrency: normalizedSalary.salaryCurrency,
    salaryPeriod: normalizedSalary.salaryPeriod,
    experienceMin: normalizedExperience.experienceMin,
    experienceMax: normalizedExperience.experienceMax,
    responsibilities: input.responsibilities ?? null,
    requirements: input.requirements ?? null,
    educationRequirements: input.educationRequirements ?? null,
    benefits: input.benefits ?? null,
    postedAt,
    deadline,
    applicationUrl: input.applicationUrl ?? null,
    sourceId: input.sourceId,
    externalId: input.externalId ?? null,
    sourceUrl: input.sourceUrl ?? null,
    rawHash,
  });

  // 7. Return result
  return {
    outcome: "CREATED",
    jobId,
    jobSourceId,
    matchedJobId: null,
    matchedJobSourceId: null,
    duplicateLevel: null,
    duplicateConfidence: null,
    duplicateReason: null,
  };
}

export type { RawJobInput, IngestionResult, IngestionOutcome } from "./types";
