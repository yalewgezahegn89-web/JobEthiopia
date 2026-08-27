/**
 * Ingestion boundary types for the JobEthiopia job ingestion pipeline.
 *
 * These types define the contract between external source adapters
 * and the ingestion orchestrator.
 */

/**
 * Raw job data as provided by an external source.
 *
 * Fields map to the existing jobs/job_sources schemas and
 * normalization utilities. Nullable/optional fields reflect the
 * actual database schema optionality.
 */
export interface RawJobInput {
  /** Raw job title (will be normalized) */
  title: string;
  /** Raw job description, may contain HTML (will be normalized) */
  description: string;
  /** Organization name as provided by the source (will be normalized and resolved) */
  organizationName: string;
  /** Location name as provided by the source (will be normalized and resolved) */
  locationName?: string | null;
  /** Profession name as provided by the source (will be normalized and resolved) */
  professionName?: string | null;
  /** Category name as provided by the source (will be normalized and resolved) */
  categoryName?: string | null;
  /** Raw employment type string (will be normalized to enum) */
  employmentType?: string | null;
  /** Raw salary text, e.g. "ETB 5000-8000 monthly" (will be parsed) */
  salaryRaw?: string | null;
  /** Raw experience text, e.g. "3-5 years" (will be parsed) */
  experienceRaw?: string | null;
  /** Job responsibilities (raw text) */
  responsibilities?: string | null;
  /** Job requirements (raw text) */
  requirements?: string | null;
  /** Education requirements (raw text) */
  educationRequirements?: string | null;
  /** Job benefits (raw text) */
  benefits?: string | null;
  /** Raw posted-at date string (ISO 8601) */
  postedAt?: string | null;
  /** Raw deadline date string (ISO 8601) */
  deadline?: string | null;
  /** Application URL */
  applicationUrl?: string | null;
  /** ID of the source this listing comes from (references sources.id) */
  sourceId: string;
  /** Source's unique identifier for this listing */
  externalId?: string | null;
  /** Source URL of the listing */
  sourceUrl?: string | null;
}

/**
 * The outcome of an ingestion attempt.
 */
export type IngestionOutcome =
  | "CREATED"
  | "DUPLICATE"
  | "POSSIBLE_DUPLICATE";

/**
 * Result returned by the ingestion orchestrator.
 */
export interface IngestionResult {
  /** The outcome of the ingestion attempt */
  outcome: IngestionOutcome;
  /** ID of the created job, or null if not created */
  jobId: string | null;
  /** ID of the created job_source record, or null if not created */
  jobSourceId: string | null;
  /** ID of the matched existing job (from duplicate detection), or null */
  matchedJobId: string | null;
  /** ID of the matched existing job_source (from duplicate detection), or null */
  matchedJobSourceId: string | null;
  /** The duplicate detection level that triggered, or null */
  duplicateLevel: string | null;
  /** Confidence score from duplicate detection, or null */
  duplicateConfidence: number | null;
  /** Human-readable reason from duplicate detection, or null */
  duplicateReason: string | null;
}
