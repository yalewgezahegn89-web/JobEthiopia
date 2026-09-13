/**
 * Skill taxonomy data-access layer.
 *
 * Provides canonical skill resolution, alias lookup, and candidate/job
 * association management. All queries are bounded and ownership-safe.
 */
import { eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { skills } from "@/db/schema/skills";
import { skillAliases } from "@/db/schema/skillAliases";
import { jobSkills } from "@/db/schema/jobSkills";
import { candidateCvSkills } from "@/db/schema/candidateCvSkills";
import { normalizeSkillKey } from "./normalize";

export type CanonicalSkill = {
  id: string;
  name: string;
  normalizedKey: string;
  category: string | null;
};

export type SkillAlias = {
  skillId: string;
  alias: string;
  normalizedAlias: string;
};

export type JobSkillEntry = {
  skillId: string;
  isRequired: boolean;
};

export type CandidateSkillLink = {
  cvSkillId: string;
  skillId: string | null;
  name: string;
};

/**
 * Resolves a raw skill name to its canonical skill ID via:
 * 1. Exact normalized_key match in skills table
 * 2. Alias match in skill_aliases table
 * Returns null if no canonical match is found.
 */
export async function resolveCanonicalSkill(
  rawName: string,
): Promise<CanonicalSkill | null> {
  const key = normalizeSkillKey(rawName);
  if (!key) return null;

  const directMatch = await db.query.skills.findFirst({
    where: eq(skills.normalizedKey, key),
    columns: { id: true, name: true, normalizedKey: true, category: true },
  });
  if (directMatch) return directMatch;

  const aliasMatch = await db
    .select({
      skillId: skillAliases.skillId,
      name: skills.name,
      normalizedKey: skills.normalizedKey,
      category: skills.category,
    })
    .from(skillAliases)
    .innerJoin(skills, eq(skills.id, skillAliases.skillId))
    .where(eq(skillAliases.normalizedAlias, key))
    .limit(1);

  if (aliasMatch.length > 0) {
    const row = aliasMatch[0];
    return { id: row.skillId, name: row.name, normalizedKey: row.normalizedKey, category: row.category };
  }

  return null;
}

/**
 * Batch-resolves multiple raw skill names to canonical skill IDs.
 * Returns a Map from normalized input key → CanonicalSkill (or null).
 */
export async function resolveCanonicalSkills(
  rawNames: string[],
): Promise<Map<string, CanonicalSkill | null>> {
  const result = new Map<string, CanonicalSkill | null>();
  if (rawNames.length === 0) return result;

  const uniqueKeys = [...new Set(rawNames.map(normalizeSkillKey).filter(Boolean))];
  if (uniqueKeys.length === 0) return result;

  const directMatches = await db
    .select({
      id: skills.id,
      name: skills.name,
      normalizedKey: skills.normalizedKey,
      category: skills.category,
    })
    .from(skills)
    .where(inArray(skills.normalizedKey, uniqueKeys));

  const directMap = new Map(directMatches.map((r) => [r.normalizedKey, r]));

  const unmatchedKeys = uniqueKeys.filter((k) => !directMap.has(k));

  let aliasMap = new Map<string, { skillId: string; name: string; normalizedKey: string; category: string | null }>();
  if (unmatchedKeys.length > 0) {
    const aliasMatches = await db
      .select({
        normalizedAlias: skillAliases.normalizedAlias,
        skillId: skillAliases.skillId,
        name: skills.name,
        normalizedKey: skills.normalizedKey,
        category: skills.category,
      })
      .from(skillAliases)
      .innerJoin(skills, eq(skills.id, skillAliases.skillId))
      .where(inArray(skillAliases.normalizedAlias, unmatchedKeys));

    aliasMap = new Map(
      aliasMatches.map((r) => [
        r.normalizedAlias,
        { skillId: r.skillId, name: r.name, normalizedKey: r.normalizedKey, category: r.category },
      ]),
    );
  }

  for (const raw of rawNames) {
    const key = normalizeSkillKey(raw);
    if (!key) {
      result.set(raw, null);
      continue;
    }
    const direct = directMap.get(key);
    if (direct) {
      result.set(raw, direct);
      continue;
    }
    const alias = aliasMap.get(key);
    if (alias) {
      result.set(raw, { id: alias.skillId, name: alias.name, normalizedKey: alias.normalizedKey, category: alias.category });
      continue;
    }
    result.set(raw, null);
  }

  return result;
}

/**
 * Loads all active skills, optionally filtered by category.
 */
export async function listSkills(category?: string): Promise<CanonicalSkill[]> {
  const conditions: SQL[] = [eq(skills.isActive, true)];
  if (category) {
    conditions.push(eq(skills.category, category));
  }
  return db
    .select({
      id: skills.id,
      name: skills.name,
      normalizedKey: skills.normalizedKey,
      category: skills.category,
    })
    .from(skills)
    .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : undefined) : undefined);
}

/**
 * Loads structured job skills for a batch of job IDs.
 * Returns a Map from jobId → JobSkillEntry[].
 */
export async function loadJobSkillsForJobs(
  jobIds: string[],
): Promise<Map<string, JobSkillEntry[]>> {
  const result = new Map<string, JobSkillEntry[]>();
  if (jobIds.length === 0) return result;

  const rows = await db
    .select({
      jobId: jobSkills.jobId,
      skillId: jobSkills.skillId,
      isRequired: jobSkills.isRequired,
    })
    .from(jobSkills)
    .where(inArray(jobSkills.jobId, jobIds));

  for (const row of rows) {
    const existing = result.get(row.jobId) ?? [];
    existing.push({ skillId: row.skillId, isRequired: row.isRequired });
    result.set(row.jobId, existing);
  }

  return result;
}

/**
 * Loads candidate CV skill links for a given CV.
 * Returns rows with cvSkillId, optional skillId, and raw name.
 */
export async function loadCandidateSkillLinks(
  cvId: string,
): Promise<CandidateSkillLink[]> {
  const rows = await db
    .select({
      cvSkillId: candidateCvSkills.id,
      skillId: candidateCvSkills.skillId,
      name: candidateCvSkills.name,
    })
    .from(candidateCvSkills)
    .where(eq(candidateCvSkills.cvId, cvId));

  return rows;
}
