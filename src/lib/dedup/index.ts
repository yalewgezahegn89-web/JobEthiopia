import { eq, and, ilike, isNull, desc } from "drizzle-orm";
import { db } from "../../db";
import { jobSources } from "../../db/schema/jobSources";
import { jobs } from "../../db/schema/jobs";
import { canonicalizeUrl } from "./canonicalUrl";
import { escapeLikePattern } from "../apiUtils";
import type {
  DuplicateDetectionInput,
  DuplicateDetectionResult,
} from "./types";

/**
 * Detects duplicates using a four-level cascade: SOURCE_IDENTIFIER → SOURCE_URL → CONTENT_HASH → ORG_TITLE_LOCATION.
 *
 * This function is **read-only** — it never creates, updates, or deletes records.
 *
 * The `rawHash` parameter must be supplied by the caller. Use the existing
 * `computeContentHash()` utility from `src/lib/normalization/hash` to generate
 * the hash before calling this function. `detectDuplicate()` does not calculate
 * or persist the hash.
 */
export async function detectDuplicate(
  input: DuplicateDetectionInput,
): Promise<DuplicateDetectionResult> {
  const {
    sourceId,
    externalId,
    sourceUrl,
    rawHash,
    organizationId,
    normalizedTitle,
    locationId,
  } = input;

  const trimmedExternalId = externalId?.trim() || null;
  const trimmedSourceUrl = sourceUrl?.trim() || null;
  const trimmedHash = rawHash?.trim() || null;

  // Level 1 — SOURCE_IDENTIFIER
  if (trimmedExternalId) {
    const match = await db.query.jobSources.findFirst({
      where: and(
        eq(jobSources.sourceId, sourceId),
        eq(jobSources.externalId, trimmedExternalId),
      ),
      columns: { id: true, jobId: true },
    });

    if (match) {
      return {
        classification: "DUPLICATE",
        level: "SOURCE_IDENTIFIER",
        matchedJobId: match.jobId,
        matchedJobSourceId: match.id,
        confidence: 1.0,
        reason: `Exact source identifier match: source_id=${sourceId}, external_id=${trimmedExternalId}`,
      };
    }
  }

  // Level 2 — SOURCE_URL
  const canonicalUrl = canonicalizeUrl(trimmedSourceUrl);
  if (canonicalUrl) {
    const match = await db.query.jobSources.findFirst({
      where: and(
        eq(jobSources.sourceId, sourceId),
        eq(jobSources.sourceUrl, canonicalUrl),
      ),
      columns: { id: true, jobId: true },
    });

    if (match) {
      return {
        classification: "DUPLICATE",
        level: "SOURCE_URL",
        matchedJobId: match.jobId,
        matchedJobSourceId: match.id,
        confidence: 0.99,
        reason: `Canonical source URL match: source_id=${sourceId}, source_url=${canonicalUrl}`,
      };
    }
  }

  // Level 3 — CONTENT_HASH
  if (trimmedHash) {
    const match = await db.query.jobSources.findFirst({
      where: eq(jobSources.rawHash, trimmedHash),
      columns: { id: true, jobId: true },
    });

    if (match) {
      return {
        classification: "DUPLICATE",
        level: "CONTENT_HASH",
        matchedJobId: match.jobId,
        matchedJobSourceId: match.id,
        confidence: 0.95,
        reason: `Content hash match: raw_hash=${trimmedHash}`,
      };
    }
  }

  // Level 4 — ORG_TITLE_LOCATION (only if Levels 1–3 found no match)
  const titleNormalized = normalizedTitle.trim();
  if (titleNormalized) {
    const locationCondition = locationId
      ? eq(jobs.locationId, locationId)
      : isNull(jobs.locationId);

    const match = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.organizationId, organizationId),
        ilike(jobs.title, escapeLikePattern(titleNormalized)),
        locationCondition,
      ),
      orderBy: [desc(jobs.updatedAt), desc(jobs.createdAt)],
      columns: { id: true },
    });

    if (match) {
      return {
        classification: "POSSIBLE_DUPLICATE",
        level: "ORG_TITLE_LOCATION",
        matchedJobId: match.id,
        matchedJobSourceId: null,
        confidence: 0.80,
        reason: `Organization + title + location match: org_id=${organizationId}, title=${titleNormalized}, location_id=${locationId ?? "NULL"}`,
      };
    }
  }

  // No match at any level
  return {
    classification: "UNIQUE",
    level: null,
    matchedJobId: null,
    matchedJobSourceId: null,
    confidence: 1.0,
    reason: "No duplicate detected at any level",
  };
}
