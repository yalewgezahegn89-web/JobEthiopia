import type { RawJobInput } from "../ingestion/types";

/**
 * Represents the outcome of a source fetch operation.
 */
export type FetchResult =
  | { success: true; jobs: RawJobInput[] }
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
