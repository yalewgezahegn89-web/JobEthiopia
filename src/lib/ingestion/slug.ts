/**
 * Deterministic slug generation from normalized text.
 *
 * Produces lowercase alphanumeric slugs with hyphens, matching the
 * slugRegex pattern used by the existing Zod validation schemas:
 * /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 *
 * Requirements:
 * - lowercase
 * - whitespace converted to hyphens
 * - remove unsafe/non-slug characters
 * - collapse repeated hyphens
 * - remove leading/trailing hyphens
 * - deterministic output
 * - safe fallback if the source text produces an empty slug
 */
export function generateSlug(input: string): string {
  let result = input.toLowerCase().trim();
  result = result.replace(/[^a-z0-9\s-]/g, "");
  result = result.replace(/\s+/g, "-");
  result = result.replace(/-+/g, "-");
  result = result.replace(/^-|-$/g, "");
  return result || "untitled";
}
