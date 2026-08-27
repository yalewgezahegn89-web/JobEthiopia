/**
 * Source health types for the JobEthiopia source health management module.
 *
 * These types represent the operational state of data sources,
 * using the existing operational columns in the sources table.
 */

/**
 * The health status of a data source.
 *
 * Maps directly to the 5 operational columns in the sources table:
 * - lastSuccessfulCheck
 * - lastAttemptedCheck
 * - lastError
 * - checkFrequencyMinutes
 * - consecutiveFailures
 */
export interface SourceHealthStatus {
  /** The source ID */
  sourceId: string;
  /** Timestamp of the last successful check, or null if never checked successfully */
  lastSuccessfulCheck: Date | null;
  /** Timestamp of the last check attempt (success or failure), or null if never attempted */
  lastAttemptedCheck: Date | null;
  /** Error message from the last failed check, or null if no error */
  lastError: string | null;
  /** Configured check frequency in minutes, or null if not configured */
  checkFrequencyMinutes: number | null;
  /** Number of consecutive failed checks since the last success */
  consecutiveFailures: number;
}
