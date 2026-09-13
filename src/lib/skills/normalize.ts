/**
 * Skill normalization utilities for the skill taxonomy.
 *
 * Normalization is deterministic: lowercase, trim, collapse whitespace,
 * strip non-alphanumeric characters (except spaces). This produces a stable
 * key that can be matched against the skills table and aliases.
 */

const NON_ALPHANUMERIC_RE = /[^a-z0-9\s]/g;
const MULTIPLE_SPACES_RE = /\s+/g;

export function normalizeSkillKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_RE, "")
    .replace(MULTIPLE_SPACES_RE, " ")
    .trim();
}
