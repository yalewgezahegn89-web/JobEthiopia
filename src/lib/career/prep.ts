/**
 * Candidate career preparation helpers (Phase 13 — Career Tools).
 *
 * Reuses the existing skills taxonomy + job-skills association so job-specific
 * preparation never duplicates or re-enters job data. `buildExperienceText`
 * is pure (deterministic); `loadJobSkillsWithNames` is the single DB read for
 * a job's prep checklist.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobSkills } from "@/db/schema/jobSkills";
import { skills } from "@/db/schema/skills";

export type JobPrepSkill = {
  name: string;
  isRequired: boolean;
};

/**
 * Renders the experience expectation range consistently: "3 years",
 * "3 - 5 years", "3+ years", or "Up to 5 years". Null when unknown.
 */
export function buildExperienceText(
  min: number | null,
  max: number | null,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min} years` : `${min} - ${max} years`;
  }
  if (min != null) return `${min}+ years`;
  return `Up to ${max} years`;
}

/**
 * Loads the named skills attached to jobs, grouped per job, ordered by name.
 * Skills without a row in the active taxonomy are deliberately absent — the
 * job page only claims skills that actually exist.
 */
export async function loadJobSkillsWithNames(
  jobIds: string[],
): Promise<Map<string, JobPrepSkill[]>> {
  const result = new Map<string, JobPrepSkill[]>();
  if (jobIds.length === 0) return result;

  const rows = await db
    .select({
      jobId: jobSkills.jobId,
      isRequired: jobSkills.isRequired,
      name: skills.name,
    })
    .from(jobSkills)
    .innerJoin(skills, eq(skills.id, jobSkills.skillId))
    .where(inArray(jobSkills.jobId, jobIds));

  for (const row of rows) {
    const list = result.get(row.jobId) ?? [];
    list.push({ name: row.name, isRequired: row.isRequired });
    result.set(row.jobId, list);
  }

  for (const list of result.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}