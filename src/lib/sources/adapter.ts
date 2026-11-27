import type { RawJobInput } from "../ingestion/types";

/**
 * Optional per-fetch bookkeeping returned by adapters that support
 * reconciliation (for example Facebook Page ingestion).
 */
export interface FetchMetadata {
  /**
   * Every external id observed in the fetch, including items that were not
   * converted into jobs. Used to detect listings that disappeared upstream.
   */
  observedExternalIds?: string[];
  /**
   * Items that were ingested as drafts but need moderator attention, with the
   * deterministic reasons why.
   */
  reviewItems?: Array<{ externalId: string; reasons: string[] }>;
}

/**
 * Represents the outcome of a source fetch operation.
 */
export type FetchResult =
  | { success: true; jobs: RawJobInput[]; metadata?: FetchMetadata }
  | { success: false; error: string };

/**
 * Contract for source adapters that fetch job listings from external sources.
 *
 * Adapters are responsible for:
 * - Fetching data from the external source
 * - Parsing/transforming the response into RawJobInput format
 * - Handling source-specific errors
 *
 * Adapters are NOT responsible for:
 * - Normalization
 * - Validation
 * - Deduplication
 * - Database writes
 * - Health reporting
 * - Rate limiting
 */
export interface SourceAdapter {
  /**
   * Fetches job listings from the external source.
   *
   * @param sourceId - The ID of the source from the sources table
   * @returns FetchResult containing RawJobInput[] on success,
   *          or error details on failure
   */
  fetchJobs(sourceId: string): Promise<FetchResult>;
}
