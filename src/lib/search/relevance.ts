/**
 * Deterministic job-search relevance (Phase 8 Batch 2).
 *
 * Job search supports two PostgreSQL tiers, both deterministic, bounded and
 * explainable:
 *
 *  - "substring" (default, always available): inclusion via ILIKE with a
 *    weighted CASE expression ordering exact/prefix/substring title matches
 *    above organization-name and description matches.
 *  - "trgm" (capability-gated on pg_trgm): inclusion broadened by trigram
 *    similarity thresholds and ordering by GREATEST(similarity(...)).
 *
 * Scores are normalized to [0, 1]: a title match always outweighs an
 * organization or description match, so low-signal matches never displace
 * strong title matches.
 */
import { sql as drizzleSql, type SQL } from "drizzle-orm";
import { jobs } from "@/db/schema/jobs";
import { escapeLikePattern } from "@/lib/apiUtils";

export const RELEVANCE_WEIGHTS = {
  exactTitle: 1,
  prefixTitle: 0.85,
  substringTitle: 0.7,
  organization: 0.5,
  description: 0.35,
} as const;

export const MIN_TRGM_SIMILARITY = 0.3;

export type RelevanceMatchFlags = {
  exactTitle: boolean;
  prefixTitle: boolean;
  substringTitle: boolean;
  organization: boolean;
  description: boolean;
};

/**
 * Pure relevance score [0, 1]. The strongest applicable signal wins; tiers
 * are mutually exclusive by construction so the result is deterministic.
 */
export function computeRelevanceScore(flags: RelevanceMatchFlags): number {
  if (flags.exactTitle) return RELEVANCE_WEIGHTS.exactTitle;
  if (flags.prefixTitle) return RELEVANCE_WEIGHTS.prefixTitle;
  if (flags.substringTitle) return RELEVANCE_WEIGHTS.substringTitle;
  if (flags.organization) return RELEVANCE_WEIGHTS.organization;
  if (flags.description) return RELEVANCE_WEIGHTS.description;
  return 0;
}

export type RelevanceOrderInput = {
  q: string;
  organizationIds: string[];
  trgm: boolean;
};

/**
 * ORDER BY expression for relevance mode. Both tiers are fully
 * parameterized (the query term never ends up inline in the SQL string) and
 * produce deterministic, bounded scores.
 */
export function buildRelevanceOrderExpression(
  input: RelevanceOrderInput,
): SQL {
  const { q, organizationIds, trgm } = input;

  if (trgm) {
    return drizzleSql`
      GREATEST(
        similarity(${jobs.title}, ${q}),
        similarity(${jobs.description}, ${q}) * ${RELEVANCE_WEIGHTS.description},
        CASE
          WHEN ${jobs.organizationId} = ANY(${organizationIds})
            THEN ${RELEVANCE_WEIGHTS.organization}
          ELSE 0
        END
      )
    `;
  }

  const escaped = escapeLikePattern(q);
  const containsPattern = `%${escaped}%`;
  const prefixPattern = `${escaped}%`;

  return drizzleSql`
    CASE
      WHEN LOWER(${jobs.title}) = LOWER(${q}) THEN ${RELEVANCE_WEIGHTS.exactTitle}
      WHEN ${jobs.title} ILIKE ${prefixPattern} THEN ${RELEVANCE_WEIGHTS.prefixTitle}
      WHEN ${jobs.title} ILIKE ${containsPattern} THEN ${RELEVANCE_WEIGHTS.substringTitle}
      WHEN ${jobs.organizationId} = ANY(${organizationIds}) THEN ${RELEVANCE_WEIGHTS.organization}
      WHEN ${jobs.description} ILIKE ${containsPattern} THEN ${RELEVANCE_WEIGHTS.description}
      ELSE 0
    END
  `;
}