import { ingestJob } from "./ingest";
import type { RawJobInput, IngestionResult } from "./types";

/**
 * Input for batch ingestion.
 *
 * The batch-level sourceId identifies which source all jobs in this
 * batch originate from. It is injected into each job's sourceId field
 * before processing, ensuring consistent source attribution.
 *
 * Jobs are processed sequentially in input order.
 */
export interface BatchIngestionInput {
  /** ID of the source this batch originates from (references sources.id) */
  sourceId: string;
  /** Array of raw job listings to ingest */
  jobs: RawJobInput[];
}

/**
 * The result of processing a single job within a batch.
 *
 * Extends IngestionResult with an error field for failed items.
 */
export interface BatchIngestionItemResult extends IngestionResult {
  /** Zero-based index of this job in the input array */
  index: number;
  /** Error message if the job failed to process, null if successful */
  error: string | null;
}

/**
 * Aggregate result of a batch ingestion operation.
 */
export interface BatchIngestionResult {
  /** Per-item results in input order */
  items: BatchIngestionItemResult[];
  /** Aggregate counts */
  summary: {
    /** Total number of jobs submitted */
    total: number;
    /** Number of jobs successfully created */
    created: number;
    /** Number of jobs classified as DUPLICATE */
    duplicate: number;
    /** Number of jobs classified as POSSIBLE_DUPLICATE */
    possibleDuplicate: number;
    /** Number of jobs that failed to process */
    failed: number;
  };
}

/**
 * Ingests multiple raw job listings in a single batch operation.
 *
 * The batch-level sourceId is injected into each job before processing,
 * ensuring all jobs are attributed to the same source.
 *
 * Jobs are processed sequentially in input order. Each job is processed
 * independently — a failure in one job does not abort the batch.
 *
 * This function:
 * - injects the batch sourceId into each job
 * - calls ingestJob() for each item (reuses the existing pipeline)
 * - isolates errors per item
 * - preserves result ordering exactly
 * - returns aggregate summary counts
 *
 * This function must NOT:
 * - process jobs concurrently
 * - modify source health fields
 * - retry failed items
 * - update existing jobs
 *
 * @param input - Batch of raw job listings to ingest
 * @returns BatchIngestionResult with per-item outcomes and summary
 */
export async function ingestJobs(
  input: BatchIngestionInput,
): Promise<BatchIngestionResult> {
  const items: BatchIngestionItemResult[] = [];

  let created = 0;
  let duplicate = 0;
  let possibleDuplicate = 0;
  let failed = 0;

  for (let i = 0; i < input.jobs.length; i++) {
    try {
      const job = { ...input.jobs[i], sourceId: input.sourceId };
      const result: IngestionResult = await ingestJob(job);

      items.push({
        ...result,
        index: i,
        error: null,
      });

      switch (result.outcome) {
        case "CREATED":
          created++;
          break;
        case "DUPLICATE":
          duplicate++;
          break;
        case "POSSIBLE_DUPLICATE":
          possibleDuplicate++;
          break;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);

      items.push({
        outcome: "CREATED",
        jobId: null,
        jobSourceId: null,
        matchedJobId: null,
        matchedJobSourceId: null,
        duplicateLevel: null,
        duplicateConfidence: null,
        duplicateReason: null,
        index: i,
        error: message,
      });

      failed++;
    }
  }

  return {
    items,
    summary: {
      total: input.jobs.length,
      created,
      duplicate,
      possibleDuplicate,
      failed,
    },
  };
}
