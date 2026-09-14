import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { organizations } from "@/db/schema/organizations";
import { getAdapterForSource } from "@/lib/sources/adapters";
import {
  normalizeTitle,
  normalizeOrganization,
  normalizeDescription,
  normalizeEmploymentType,
  normalizeSalary,
  normalizeExperience,
} from "@/lib/normalization";
import { computeContentHash } from "@/lib/normalization/hash";
import { detectDuplicate } from "@/lib/dedup";
import { generateSlug } from "./slug";
import { validateRawJobInput } from "@/lib/validations/rawJobInput";
import type { RawJobInput } from "./types";

/**
 * Result of validating a single item in dry-run mode.
 */
export interface DryRunItemResult {
  index: number;
  valid: boolean;
  title: string | null;
  organizationName: string | null;
  normalizedTitle: string | null;
  normalizedOrg: string | null;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  duplicateClassification: string | null;
  duplicateLevel: string | null;
  duplicateConfidence: number | null;
  duplicateReason: string | null;
  errors: string[];
}

/**
 * Aggregate result of a dry-run validation.
 */
export interface DryRunResult {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  fetchSuccess: boolean;
  fetchError: string | null;
  totalFetched: number;
  totalValid: number;
  totalInvalid: number;
  totalDuplicate: number;
  totalNew: number;
  items: DryRunItemResult[];
  durationMs: number;
}

/**
 * Dry-run ingestion for a source: fetches, validates, normalizes, and checks
 * for duplicates WITHOUT writing to the database.
 *
 * Used by admins to validate a new source before enabling it.
 *
 * This function:
 * - fetches from the real source (network call)
 * - validates each item against the feed schema
 * - normalizes each valid item
 * - checks for duplicates via the existing dedup cascade (read-only)
 * - reports all findings
 *
 * This function must NOT:
 * - write any rows to the database
 * - modify source health fields
 * - create organizations/locations/professions/categories
 * - publish or create jobs
 */
export async function dryRunSourceIngestion(
  sourceId: string,
): Promise<DryRunResult> {
  const start = performance.now();

  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, name: true, sourceType: true, isActive: true },
  });

  if (!source) {
    return {
      sourceId,
      sourceName: "Unknown",
      sourceType: "Unknown",
      fetchSuccess: false,
      fetchError: "Source not found",
      totalFetched: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDuplicate: 0,
      totalNew: 0,
      items: [],
      durationMs: elapsedMs(start),
    };
  }

  const adapter = getAdapterForSource(source.sourceType);
  if (!adapter) {
    return {
      sourceId,
      sourceName: source.name,
      sourceType: source.sourceType,
      fetchSuccess: false,
      fetchError: `Unsupported source type: ${source.sourceType}`,
      totalFetched: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDuplicate: 0,
      totalNew: 0,
      items: [],
      durationMs: elapsedMs(start),
    };
  }

  let fetch;
  try {
    fetch = await adapter.fetchJobs(sourceId);
  } catch (err: unknown) {
    return {
      sourceId,
      sourceName: source.name,
      sourceType: source.sourceType,
      fetchSuccess: false,
      fetchError: err instanceof Error ? err.message : "Fetch failed",
      totalFetched: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDuplicate: 0,
      totalNew: 0,
      items: [],
      durationMs: elapsedMs(start),
    };
  }

  if (!fetch.success) {
    return {
      sourceId,
      sourceName: source.name,
      sourceType: source.sourceType,
      fetchSuccess: false,
      fetchError: fetch.error,
      totalFetched: 0,
      totalValid: 0,
      totalInvalid: 0,
      totalDuplicate: 0,
      totalNew: 0,
      items: [],
      durationMs: elapsedMs(start),
    };
  }

  const items: DryRunItemResult[] = [];
  let totalValid = 0;
  let totalInvalid = 0;
  let totalDuplicate = 0;
  let totalNew = 0;

  for (let i = 0; i < fetch.jobs.length; i++) {
    const raw = fetch.jobs[i];
    const itemResult = await validateAndCheckDuplicate(raw, i, sourceId);
    items.push(itemResult);

    if (itemResult.valid) {
      totalValid++;
      if (
        itemResult.duplicateClassification === "DUPLICATE" ||
        itemResult.duplicateClassification === "POSSIBLE_DUPLICATE"
      ) {
        totalDuplicate++;
      } else {
        totalNew++;
      }
    } else {
      totalInvalid++;
    }
  }

  return {
    sourceId,
    sourceName: source.name,
    sourceType: source.sourceType,
    fetchSuccess: true,
    fetchError: null,
    totalFetched: fetch.jobs.length,
    totalValid,
    totalInvalid,
    totalDuplicate,
    totalNew,
    items,
    durationMs: elapsedMs(start),
  };
}

/**
 * Validates a single raw job input, normalizes it, and checks for duplicates
 * without writing to the database.
 */
async function validateAndCheckDuplicate(
  raw: RawJobInput,
  index: number,
  sourceId: string,
): Promise<DryRunItemResult> {
  const errors: string[] = [];

  // Validate
  const validation = validateRawJobInput(raw);
  if (!validation.success) {
    return {
      index,
      valid: false,
      title: raw.title ?? null,
      organizationName: raw.organizationName ?? null,
      normalizedTitle: null,
      normalizedOrg: null,
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      experienceMin: null,
      experienceMax: null,
      duplicateClassification: null,
      duplicateLevel: null,
      duplicateConfidence: null,
      duplicateReason: null,
      errors: [validation.error],
    };
  }

  // Normalize
  const normalizedTitle = normalizeTitle(raw.title);
  const normalizedOrg = normalizeOrganization(raw.organizationName);
  const normalizedDescription = normalizeDescription(raw.description);
  const employmentType = normalizeEmploymentType(
    (raw.employmentType as string | null) ?? null,
  );
  const salary = normalizeSalary((raw.salaryRaw as string | null) ?? null);
  const experience = normalizeExperience((raw.experienceRaw as string | null) ?? null);

  // Resolve entities (read-only: check existence, don't create)
  const orgSlug = generateSlug(normalizedOrg);

  const existingOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
    columns: { id: true },
  });

  // Check duplicate (read-only queries only)
  const rawHash = computeContentHash({
    normalizedTitle,
    organizationId: existingOrg?.id ?? "",
    locationId: "",
    normalizedDescription,
    deadline: "",
    applicationUrl: (raw.applicationUrl as string) ?? "",
  });

  const duplicateResult = await detectDuplicate({
    sourceId,
    externalId: (raw.externalId as string | null) ?? null,
    sourceUrl: (raw.sourceUrl as string | null) ?? null,
    rawHash,
    organizationId: existingOrg?.id ?? "",
    normalizedTitle,
    locationId: null,
  });

  return {
    index,
    valid: true,
    title: raw.title,
    organizationName: raw.organizationName,
    normalizedTitle,
    normalizedOrg,
    employmentType,
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryCurrency: salary.salaryCurrency,
    salaryPeriod: salary.salaryPeriod,
    experienceMin: experience.experienceMin,
    experienceMax: experience.experienceMax,
    duplicateClassification: duplicateResult.classification,
    duplicateLevel: duplicateResult.level,
    duplicateConfidence: duplicateResult.confidence,
    duplicateReason: duplicateResult.reason,
    errors,
  };
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}
