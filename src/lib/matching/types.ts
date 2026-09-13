/**
 * Job matching — shared types and scoring policy (Phase 7 Batch 11).
 *
 * This is the deterministic compatibility-scoring MVP. The scorer is a pure
 * function over a minimal, denormalized input shape designed so a future
 * semantic/AI layer can slot in later without touching callers: both a
 * deterministic and an AI scorer consume the same `CandidateMatchProfile` and
 * `JobMatchData` interfaces and produce the same `MatchScore` contract.
 *
 * The MVP deliberately performs NO external AI inference. Structured data on
 * both sides is sufficient for a bounded, explainable, testable compatibility
 * score; see the Batch 11 report section B/C for the full comparison.
 */

/** Structured candidate signals used for scoring (see report section C). */
export type CandidateMatchProfile = {
  /** Resolved candidate home location (profile location, alert location as fallback). */
  locationId: string | null;
  /** Direct parent of `locationId`, if any (deterministic region matching). */
  locationParentId: string | null;
  /** Profile `totalExperienceYears`. */
  totalExperienceYears: number | null;
  /** Explicit (job alerts) + behavioral (saved/applied jobs) category ids. */
  preferredCategoryIds: string[];
  /** Explicit (job alerts) + behavioral (saved/applied jobs) profession ids. */
  preferredProfessionIds: string[];
  /** Employment-type preferences from active job alerts. */
  preferredEmploymentTypes: string[];
  /** Normalized (lowercased, trimmed) CV skill names. */
  skills: string[];
  /** Canonical skill IDs resolved from the candidate's CV skills. */
  skillIds: string[];
};

/** A structured skill requirement on a job posting. */
export type JobSkillRequirement = {
  skillId: string;
  isRequired: boolean;
};

/** The job-side fields scoring needs, denormalized by the DAL. */
export type JobMatchData = {
  id: string;
  title: string;
  categoryId: string | null;
  professionId: string | null;
  locationId: string | null;
  locationParentId: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  employmentType: string | null;
  /** Lowercased title + description + requirements + education requirements. */
  searchableText: string;
  postedAt: string | null;
  /** Structured skill requirements (empty array = no structured skills, use text fallback). */
  jobSkills: JobSkillRequirement[];
};

export const MATCH_FACTORS = [
  "professionAndCategory",
  "location",
  "experience",
  "employmentType",
  "skills",
  "freshness",
] as const;

export type MatchFactorKey = (typeof MATCH_FACTORS)[number];

export type MatchFactor = {
  key: MatchFactorKey;
  /** Fixed factor weight; all weights sum to 1. */
  weight: number;
  /** Bounded [0, 1] factor contribution. */
  score: number;
  /** Structured, machine-readable reason used by the UI explainer. */
  detail: Record<string, string | number | string[]>;
};

export type MatchScore = {
  /** Bounded [0, 1] weighted total. */
  total: number;
  factors: MatchFactor[];
};

export const MATCH_WEIGHTS: Record<MatchFactorKey, number> = {
  professionAndCategory: 0.3,
  location: 0.25,
  experience: 0.2,
  employmentType: 0.1,
  skills: 0.1,
  freshness: 0.05,
};

/** Below this total a job is not surfaced as a recommendation. */
export const MIN_RECOMMEND_SCORE = 0.35;
/** Maximum number of recommendations returned to the page. */
export const MAX_RECOMMENDATIONS = 10;
/** Size of the eligible-job pool scored per candidate. */
export const RECOMMENDATION_POOL_LIMIT = 200;