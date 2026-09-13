/**
 * Job-search query building (Phase 8 Batch 2).
 *
 * Layers deterministic, bounded relevance on top of the public eligibility
 * gate. Helpers here produce parameterized drizzle SQL fragments only — they
 * never inline raw user input into the query string.
 */
import { asc, desc, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { jobs } from "@/db/schema/jobs";
import { escapeLikePattern } from "@/lib/apiUtils";
import {
  MIN_TRGM_SIMILARITY,
  buildRelevanceOrderExpression,
} from "./relevance";

export type SearchTier = "substring" | "trgm";

export type KeywordMatchInput = {
  q: string;
  organizationNameIds: string[];
  tier: SearchTier;
};

/**
 * Range-overlap salary filter. A missing bound produces no condition; jobs
 * with an unset salary (salary_min/salary_max IS NULL) are treated as
 * unknown/unlimited and always satisfy the filter.
 */
export function buildSalaryConditions(
  salaryMin?: number,
  salaryMax?: number,
): SQL[] {
  const conditions: SQL[] = [];
  if (salaryMin !== undefined) {
    // Jobs with an unknown salary (salary_max IS NULL) are treated as
    // unlimited and therefore always match.
    conditions.push(
      sql`(${jobs.salaryMax} IS NULL OR ${jobs.salaryMax} >= ${salaryMin})`,
    );
  }
  if (salaryMax !== undefined) {
    conditions.push(
      sql`(${jobs.salaryMin} IS NULL OR ${jobs.salaryMin} <= ${salaryMax})`,
    );
  }
  return conditions;
}

export function buildKeywordMatchCondition(
  input: KeywordMatchInput,
): SQL {
  const escaped = escapeLikePattern(input.q);
  const pattern = `%${escaped}%`;

  const titleOrDescription = or(
    ilike(jobs.title, pattern),
    ilike(jobs.description, pattern),
  ) as unknown as SQL;

  const parts: SQL[] = [titleOrDescription];
  if (input.organizationNameIds.length > 0) {
    parts.push(inArray(jobs.organizationId, input.organizationNameIds));
  }
  if (input.tier === "trgm") {
    parts.push(
      sql`similarity(${jobs.title}, ${input.q}) >= ${MIN_TRGM_SIMILARITY}`,
      sql`similarity(${jobs.description}, ${input.q}) >= ${MIN_TRGM_SIMILARITY}`,
    );
  }

  return parts.length === 1 ? parts[0] : (or(...parts) as SQL);
}

export type JobListOrderInput = {
  q: string;
  organizationIds: string[];
  trgm: boolean;
};

export type JobListSort = "relevance" | "newest" | "deadline";

/**
 * Deterministic ordering with a stable tie-break (`createdAt DESC, id ASC`)
 * so pagination does not drift between pages.
 */
export function buildJobListOrder(
  sort: JobListSort,
  input: JobListOrderInput,
): SQL[] {
  switch (sort) {
    case "deadline":
      return [
        sql`${jobs.deadline} ASC NULLS LAST`,
        desc(jobs.createdAt),
        asc(jobs.id),
      ];
    case "relevance":
      return [
        sql`${buildRelevanceOrderExpression({ ...input })} DESC`,
        desc(jobs.createdAt),
        asc(jobs.id),
      ];
    case "newest":
    default:
      return [desc(jobs.createdAt), asc(jobs.id)];
  }
}