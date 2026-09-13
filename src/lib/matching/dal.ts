/**
 * Candidate recommendations data layer (Phase 7 Batch 11).
 *
 * Identity is server-resolved: `candidateId` always comes from the verified
 * session, never from client input, and recommendations are strictly
 * candidate-owned — there is no public surface and no way to request another
 * candidate's recommendations.
 *
 * The candidate profile is built from structured signals only (profile
 * location + experience, active job-alert filters, taxonomy of saved/applied
 * jobs, CV skill names). No name/email/phone/address content is read, logged,
 * or scored, and no external AI is called. Behavior is deterministic.
 *
 * Ranking: every genuinely-public job that the candidate has not saved or
 * applied to is scored in-process; results below `MIN_RECOMMEND_SCORE` are
 * dropped, the rest are ordered by score (then newest), capped at
 * `MAX_RECOMMENDATIONS`.
 */
import { and, desc, eq, inArray, notInArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { locations } from "@/db/schema/locations";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { candidateProfiles } from "@/db/schema/candidateProfiles";
import { candidateCvs } from "@/db/schema/candidateCvs";
import { candidateCvSkills } from "@/db/schema/candidateCvSkills";
import { jobAlerts } from "@/db/schema/jobAlerts";
import { savedJobs } from "@/db/schema/savedJobs";
import { applications } from "@/db/schema/applications";
import { recommendationFeedback } from "@/db/schema/recommendationFeedback";
import { buildPublicJobEligibilityConditions } from "@/lib/jobs/eligibility";
import { formatDate, formatSalary, type PublicJobSummary } from "@/lib/jobs/public";
import { loadJobSkillsForJobs, resolveCanonicalSkills } from "@/lib/skills/dal";
import {
  MAX_RECOMMENDATIONS,
  MIN_RECOMMEND_SCORE,
  RECOMMENDATION_POOL_LIMIT,
  type CandidateMatchProfile,
  type JobMatchData,
  type JobSkillRequirement,
  type MatchFactor,
} from "./types";
import { scoreJobMatch } from "./scorer";

export type RecommendationItem = {
  job: PublicJobSummary;
  score: number;
  factors: MatchFactor[];
};

export type RecommendationOptions = {
  limit?: number;
  now?: Date;
};

function sanitizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return MAX_RECOMMENDATIONS;
  }
  return Math.min(MAX_RECOMMENDATIONS, Math.max(1, Math.trunc(limit)));
}

function buildSearchableText(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function loadCandidateProfile(
  candidateId: string,
): Promise<{ profile: CandidateMatchProfile; excludedJobIds: string[] }> {
  const [profileRow, alertRows, savedJobIds, appliedJobIds, cv, hiddenJobRows] = await Promise.all([
    db.query.candidateProfiles.findFirst({
      where: eq(candidateProfiles.candidateId, candidateId),
      columns: { locationId: true, totalExperienceYears: true },
    }),
    db
      .select({
        categoryId: jobAlerts.categoryId,
        professionId: jobAlerts.professionId,
        locationId: jobAlerts.locationId,
        employmentType: jobAlerts.employmentType,
      })
      .from(jobAlerts)
      .where(and(eq(jobAlerts.userId, candidateId), eq(jobAlerts.status, "ACTIVE"))),
    db
      .select({ jobId: savedJobs.jobId })
      .from(savedJobs)
      .where(eq(savedJobs.candidateUserId, candidateId))
      .limit(500),
    db
      .select({ jobId: applications.jobId })
      .from(applications)
      .where(eq(applications.candidateUserId, candidateId))
      .limit(500),
    db.query.candidateCvs.findFirst({
      where: eq(candidateCvs.candidateId, candidateId),
      columns: { id: true },
    }),
    db
      .select({ jobId: recommendationFeedback.jobId })
      .from(recommendationFeedback)
      .where(
        and(
          eq(recommendationFeedback.userId, candidateId),
          eq(recommendationFeedback.feedbackType, "hidden"),
        ),
      )
      .limit(500),
  ]);

  const categorySet = new Set<string>();
  const professionSet = new Set<string>();
  const employmentTypeSet = new Set<string>();
  const alertLocationId = alertRows.map((row) => row.locationId).find((id) => id != null) ?? null;

  for (const alert of alertRows) {
    if (alert.categoryId) categorySet.add(alert.categoryId);
    if (alert.professionId) professionSet.add(alert.professionId);
    if (alert.employmentType) employmentTypeSet.add(alert.employmentType);
  }

  const preferenceJobIds = [
    ...savedJobIds.map((row) => row.jobId),
    ...appliedJobIds.map((row) => row.jobId),
  ];
  const uniquePreferenceJobIds = [...new Set(preferenceJobIds)];
  if (uniquePreferenceJobIds.length > 0) {
    const prefRows = await db
      .select({
        categoryId: jobs.categoryId,
        professionId: jobs.professionId,
      })
      .from(jobs)
      .where(inArray(jobs.id, uniquePreferenceJobIds));
    for (const row of prefRows) {
      if (row.categoryId) categorySet.add(row.categoryId);
      if (row.professionId) professionSet.add(row.professionId);
    }
  }

  // Expand preferred professions into their owning category so a job in the
  // same field (but a different occupation) still counts as a role-fit.
  if (professionSet.size > 0) {
    const profRows = await db
      .select({ id: professions.id, categoryId: professions.categoryId })
      .from(professions)
      .where(inArray(professions.id, [...professionSet]));
    for (const prof of profRows) {
      if (prof.categoryId) categorySet.add(prof.categoryId);
    }
  }

  let skills: string[] = [];
  let skillIds: string[] = [];
  if (cv) {
    const skillRows = await db
      .select({ name: candidateCvSkills.name, skillId: candidateCvSkills.skillId })
      .from(candidateCvSkills)
      .where(eq(candidateCvSkills.cvId, cv.id));
    const normalizedSkills = new Set<string>();
    const canonicalIds = new Set<string>();
    for (const row of skillRows) {
      const normalized = row.name.trim().toLowerCase();
      if (normalized) normalizedSkills.add(normalized);
      if (row.skillId) canonicalIds.add(row.skillId);
    }
    skills = [...normalizedSkills];
    skillIds = [...canonicalIds];

    // Also resolve via taxonomy for skills without direct skillId link
    if (skillIds.length < skills.length) {
      const unresolved = skills.filter(() => true); // all normalized names
      const resolved = await resolveCanonicalSkills(unresolved);
      for (const canonical of resolved.values()) {
        if (canonical) canonicalIds.add(canonical.id);
      }
      skillIds = [...canonicalIds];
    }
  }

  const candidateLocationId = profileRow?.locationId ?? alertLocationId;
  let candidateLocationParentId: string | null = null;
  if (candidateLocationId) {
    const loc = await db.query.locations.findFirst({
      where: eq(locations.id, candidateLocationId),
      columns: { parentId: true },
    });
    candidateLocationParentId = loc?.parentId ?? null;
  }

  // Merge hidden job IDs into exclusion set
  const hiddenJobIds = hiddenJobRows.map((row) => row.jobId);
  const allExcluded = [...new Set([...uniquePreferenceJobIds, ...hiddenJobIds])];

  return {
    profile: {
      locationId: candidateLocationId,
      locationParentId: candidateLocationParentId,
      totalExperienceYears: profileRow?.totalExperienceYears ?? null,
      preferredCategoryIds: [...categorySet],
      preferredProfessionIds: [...professionSet],
      preferredEmploymentTypes: [...employmentTypeSet],
      skills,
      skillIds,
    },
    excludedJobIds: allExcluded,
  };
}

function toSummary(row: {
  id: string;
  title: string;
  slug: string;
  organizationId: string;
  categoryId: string | null;
  professionId: string | null;
  locationId: string | null;
  organizationName: string | null;
  locationName: string | null;
  categoryName: string | null;
  professionName: string | null;
  employmentType: string | null;
  deadline: Date | null;
  postedAt: Date | null;
  verificationStatus: string;
  status: string;
  salaryMin: unknown;
  salaryMax: unknown;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}): PublicJobSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    organizationId: row.organizationId,
    categoryId: row.categoryId,
    professionId: row.professionId,
    locationId: row.locationId,
    organizationName: row.organizationName,
    locationName: row.locationName,
    categoryName: row.categoryName,
    professionName: row.professionName,
    employmentType: row.employmentType,
    salaryText: formatSalary(
      row.salaryMin as string | number | null,
      row.salaryMax as string | number | null,
      row.salaryCurrency,
      row.salaryPeriod,
    ),
    deadlineText: formatDate(row.deadline),
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    deadline: row.deadline ? row.deadline.toISOString() : null,
    verificationStatus: row.verificationStatus,
    status: row.status,
  };
}

/**
 * Returns the candidate's ranked recommendations (highest match score first).
 * Excludes jobs the candidate already saved or applied to. Empty for a
 * candidate with no usable signals (see page empty state). Never throws for a
 * missing job pool — it just returns fewer items.
 */
export async function getCandidateRecommendations(
  candidateId: string,
  options: RecommendationOptions = {},
): Promise<RecommendationItem[]> {
  const limit = sanitizeLimit(options.limit);
  const now = options.now ?? new Date();

  const { profile: candidate, excludedJobIds } = await loadCandidateProfile(
    candidateId,
  );

  const eligibility = await buildPublicJobEligibilityConditions(now);
  const conditions: SQL[] = [...eligibility.filter((condition): condition is SQL => Boolean(condition))];
  if (excludedJobIds.length > 0) {
    conditions.push(notInArray(jobs.id, excludedJobIds));
  }

  const pool = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      slug: jobs.slug,
      organizationId: jobs.organizationId,
      categoryId: jobs.categoryId,
      professionId: jobs.professionId,
      locationId: jobs.locationId,
      organizationName: organizations.name,
      locationName: locations.name,
      locationParentId: locations.parentId,
      categoryName: categories.name,
      professionName: professions.name,
      employmentType: jobs.employmentType,
      experienceMin: jobs.experienceMin,
      experienceMax: jobs.experienceMax,
      description: jobs.description,
      requirements: jobs.requirements,
      educationRequirements: jobs.educationRequirements,
      deadline: jobs.deadline,
      postedAt: jobs.postedAt,
      createdAt: jobs.createdAt,
      verificationStatus: jobs.verificationStatus,
      status: jobs.status,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      salaryPeriod: jobs.salaryPeriod,
    })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.organizationId))
    .leftJoin(locations, eq(locations.id, jobs.locationId))
    .leftJoin(categories, eq(categories.id, jobs.categoryId))
    .leftJoin(professions, eq(professions.id, jobs.professionId))
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(RECOMMENDATION_POOL_LIMIT);

  // Batch-load structured skills for all pool jobs (single query, no N+1)
  const poolJobIds = pool.map((row) => row.id);
  const jobSkillsMap = await loadJobSkillsForJobs(poolJobIds);

  const ranked: {
    item: Omit<RecommendationItem, "factors">;
    factors: MatchFactor[];
    createdAt: Date;
  }[] = [];

  for (const row of pool) {
    const structuredSkills: JobSkillRequirement[] = (jobSkillsMap.get(row.id) ?? []).map(
      (js) => ({ skillId: js.skillId, isRequired: js.isRequired }),
    );

    const jobData: JobMatchData = {
      id: row.id,
      title: row.title,
      categoryId: row.categoryId,
      professionId: row.professionId,
      locationId: row.locationId,
      locationParentId: row.locationParentId,
      experienceMin: row.experienceMin,
      experienceMax: row.experienceMax,
      employmentType: row.employmentType,
      searchableText: buildSearchableText(
        row.title,
        row.description,
        row.requirements,
        row.educationRequirements,
      ),
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
      jobSkills: structuredSkills,
    };
    const match = scoreJobMatch(candidate, jobData, now);
    if (match.total < MIN_RECOMMEND_SCORE) continue;
    ranked.push({
      item: { job: toSummary(row), score: match.total },
      factors: match.factors,
      createdAt: row.createdAt,
    });
  }

  ranked.sort(
    (a, b) =>
      b.item.score - a.item.score ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return ranked.slice(0, limit).map(({ item, factors }) => ({ ...item, factors }));
}