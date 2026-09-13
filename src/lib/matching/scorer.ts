/**
 * Deterministic compatibility scoring (Phase 7 Batch 11).
 *
 * Pure function: no DB, no I/O, no i18n. Every factor is bounded to [0, 1],
 * weighted with fixed values that sum to 1, and emits a machine-readable
 * `detail` used later to build localized "why it matches" copy. Missing data
 * never crashes — it yields a neutral or zero contribution so a well-formed
 * profile simply scores higher.
 */
import {
  MATCH_WEIGHTS,
  type CandidateMatchProfile,
  type JobMatchData,
  type MatchFactor,
  type MatchFactorKey,
  type MatchScore,
} from "./types";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Role-fit: 1.0 when the job's profession is preferred, or its category is in
 * the candidate's preferred fields. Nothing recognizable scores 0. A candidate
 * with no preferences contributes 0 (neutral weight loss, never a penalty).
 */
export function professionAndCategoryFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
): MatchFactor {
  const weight = MATCH_WEIGHTS.professionAndCategory;
  const hasPreferences =
    candidate.preferredCategoryIds.length > 0 ||
    candidate.preferredProfessionIds.length > 0;
  if (!hasPreferences) {
    return { key: "professionAndCategory", weight, score: 0, detail: { reason: "no-preferences" } };
  }
  if (job.professionId && candidate.preferredProfessionIds.includes(job.professionId)) {
    return { key: "professionAndCategory", weight, score: 1, detail: { reason: "profession" } };
  }
  if (job.categoryId && candidate.preferredCategoryIds.includes(job.categoryId)) {
    return { key: "professionAndCategory", weight, score: 1, detail: { reason: "category" } };
  }
  return { key: "professionAndCategory", weight, score: 0, detail: { reason: "none" } };
}

/**
 * Location: exact match is 1.0, same immediate parent (region/city) 0.6,
 * nested parent↔child 0.5, otherwise 0. Missing location on either side is 0.
 */
export function locationFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
): MatchFactor {
  const weight = MATCH_WEIGHTS.location;
  if (!candidate.locationId || !job.locationId) {
    return { key: "location", weight, score: 0, detail: { reason: "missing-location" } };
  }
  if (candidate.locationId === job.locationId) {
    return { key: "location", weight, score: 1, detail: { reason: "exact" } };
  }
  if (
    candidate.locationParentId &&
    candidate.locationParentId === job.locationParentId
  ) {
    return { key: "location", weight, score: 0.6, detail: { reason: "same-parent" } };
  }
  if (
    candidate.locationParentId === job.locationId ||
    job.locationParentId === candidate.locationId
  ) {
    return { key: "location", weight, score: 0.5, detail: { reason: "nested" } };
  }
  return { key: "location", weight, score: 0, detail: { reason: "different" } };
}

/**
 * Experience: no requirement = 1.0; unknown candidate years = 0; under minimum
 * by at most 2 years = 0.5 (close); over the maximum = 0.6 (overqualified is
 * not rejected); otherwise 1.0.
 */
export function experienceFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
): MatchFactor {
  const weight = MATCH_WEIGHTS.experience;
  const min = job.experienceMin;
  const max = job.experienceMax;
  if (min == null && max == null) {
    return { key: "experience", weight, score: 1, detail: { reason: "none-required" } };
  }
  if (candidate.totalExperienceYears == null) {
    return { key: "experience", weight, score: 0, detail: { reason: "missing-candidate-years" } };
  }
  const years = candidate.totalExperienceYears;
  if (min != null && years < min) {
    if (years >= min - 2) {
      return { key: "experience", weight, score: 0.5, detail: { reason: "close", gap: min - years } };
    }
    return { key: "experience", weight, score: 0, detail: { reason: "below", gap: min - years } };
  }
  if (max != null && years > max) {
    return { key: "experience", weight, score: 0.6, detail: { reason: "above", gap: years - max } };
  }
  return { key: "experience", weight, score: 1, detail: { reason: "matched" } };
}

/**
 * Employment type: a candidate without preferences (or a job without a type)
 * is neutral 0.5; otherwise matches = 1, misses = 0.
 */
export function employmentTypeFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
): MatchFactor {
  const weight = MATCH_WEIGHTS.employmentType;
  if (candidate.preferredEmploymentTypes.length === 0) {
    return { key: "employmentType", weight, score: 0.5, detail: { reason: "no-preference" } };
  }
  if (!job.employmentType) {
    return { key: "employmentType", weight, score: 0.5, detail: { reason: "job-unspecified" } };
  }
  if (candidate.preferredEmploymentTypes.includes(job.employmentType)) {
    return { key: "employmentType", weight, score: 1, detail: { reason: "matched" } };
  }
  return { key: "employmentType", weight, score: 0, detail: { reason: "mismatch" } };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary containment: the skill must appear in the job text as a
 * standalone token/phrase, avoiding accidental substring hits (e.g. "ic" in
 * "basic").
 */
export function containsSkill(text: string, skill: string): boolean {
  if (!skill) return false;
  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(skill)}([^a-z0-9]|$)`,
    "i",
  );
  return pattern.test(text);
}

/**
 * Skill overlap: for jobs with structured skill requirements, scores based on
 * required/preferred skill matches using canonical skill IDs. For jobs without
 * structured skills, falls back to word-boundary text matching.
 */
export function skillsFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
): MatchFactor {
  const weight = MATCH_WEIGHTS.skills;
  const detail: Record<string, string | number | string[]> = {};

  if (candidate.skills.length === 0 && candidate.skillIds.length === 0) {
    detail.reason = "no-skills";
    detail.matchedSkills = [];
    detail.matchedCount = 0;
    return { key: "skills", weight, score: 0, detail };
  }

  // Structured skill matching (when job has declared skills)
  if (job.jobSkills.length > 0) {
    const required = job.jobSkills.filter((js) => js.isRequired);
    const preferred = job.jobSkills.filter((js) => !js.isRequired);

    const candidateSkillIdSet = new Set(candidate.skillIds);
    const candidateNameSet = new Set(candidate.skills);

    const matchedRequired = required.filter(
      (js) =>
        candidateSkillIdSet.has(js.skillId) ||
        candidateNameSet.has(js.skillId),
    );
    const matchedPreferred = preferred.filter(
      (js) =>
        candidateSkillIdSet.has(js.skillId) ||
        candidateNameSet.has(js.skillId),
    );

    let score: number;
    if (required.length > 0) {
      score = matchedRequired.length / required.length;
      if (preferred.length > 0) {
        score = score * 0.8 + (matchedPreferred.length / preferred.length) * 0.2;
      }
    } else if (preferred.length > 0) {
      score = matchedPreferred.length / preferred.length;
    } else {
      score = 0;
    }

    const matchedNames = [
      ...matchedRequired.map((js) => js.skillId),
      ...matchedPreferred.map((js) => js.skillId),
    ].slice(0, 5);

    detail.reason = required.length > 0 ? "structured-required" : "structured-preferred";
    detail.matchedRequired = matchedRequired.length;
    detail.totalRequired = required.length;
    detail.matchedPreferred = matchedPreferred.length;
    detail.totalPreferred = preferred.length;
    detail.matchedSkills = matchedNames;
    detail.matchedCount = matchedNames.length;

    return { key: "skills", weight, score: round4(clamp01(score)), detail };
  }

  // Fallback: text-based matching (backward compatible)
  if (!job.searchableText) {
    detail.reason = "no-job-text";
    detail.matchedSkills = [];
    detail.matchedCount = 0;
    return { key: "skills", weight, score: 0, detail };
  }
  const matched: string[] = [];
  for (const skill of candidate.skills) {
    if (containsSkill(job.searchableText, skill)) {
      matched.push(skill);
      if (matched.length >= 5) break;
    }
  }
  detail.reason = matched.length > 0 ? "matched" : "none";
  detail.matchedSkills = matched;
  detail.matchedCount = matched.length;
  const score = matched.length === 0 ? 0 : Math.min(1, matched.length / 3);
  return { key: "skills", weight, score: round4(clamp01(score)), detail };
}

/**
 * Freshness: a small nudge rewarding recently posted roles. Unknown/invalid
 * dates are neutral 0.5.
 */
export function freshnessFactor(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
  now?: Date,
): MatchFactor {
  const weight = MATCH_WEIGHTS.freshness;
  if (!job.postedAt) {
    return { key: "freshness", weight, score: 0.5, detail: { reason: "unknown" } };
  }
  const posted = new Date(job.postedAt);
  if (Number.isNaN(posted.getTime())) {
    return { key: "freshness", weight, score: 0.5, detail: { reason: "unknown" } };
  }
  const days = (now ?? new Date()).getTime() - posted.getTime();
  if (days < 0) {
    return { key: "freshness", weight, score: 0.5, detail: { reason: "unknown" } };
  }
  const daysValue = days / (1000 * 60 * 60 * 24);
  if (daysValue < 7) {
    return { key: "freshness", weight, score: 1, detail: { reason: "recent" } };
  }
  if (daysValue < 30) {
    return { key: "freshness", weight, score: 0.7, detail: { reason: "fresh" } };
  }
  return { key: "freshness", weight, score: 0.4, detail: { reason: "older" } };
}

/**
 * Scores a single job against the candidate profile. Weighted sum of the six
 * bounded factors; total is clamped to [0, 1] and rounded to 4 decimals.
 */
export function scoreJobMatch(
  candidate: CandidateMatchProfile,
  job: JobMatchData,
  now?: Date,
): MatchScore {
  const factors: MatchFactor[] = [
    professionAndCategoryFactor(candidate, job),
    locationFactor(candidate, job),
    experienceFactor(candidate, job),
    employmentTypeFactor(candidate, job),
    skillsFactor(candidate, job),
    freshnessFactor(candidate, job, now),
  ];
  const rawTotal = factors.reduce((sum, factor) => sum + factor.weight * factor.score, 0);
  return { total: round4(clamp01(rawTotal)), factors };
}

/**
 * Convenience array of all factor keys in scoring order (used for stable
 * ordering in tests and UI).
 */
export const FACTOR_ORDER: MatchFactorKey[] = [
  "professionAndCategory",
  "location",
  "experience",
  "employmentType",
  "skills",
  "freshness",
];