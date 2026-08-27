import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organizations } from "../../db/schema/organizations";
import { locations } from "../../db/schema/locations";
import { professions } from "../../db/schema/professions";
import { categories } from "../../db/schema/categories";
import { normalizeOrganization, normalizeLocation } from "../normalization";
import { generateSlug } from "./slug";

/**
 * Resolves an organization by normalized name.
 *
 * 1. Normalizes the name using Batch 1 normalizeOrganization
 * 2. Generates a deterministic slug
 * 3. Looks up existing organization by slug
 * 4. If not found, creates a new organization
 * 5. Returns the organization ID
 *
 * Uses onConflictDoNothing to handle race conditions safely.
 */
export async function resolveOrganization(name: string): Promise<string> {
  const normalizedName = normalizeOrganization(name);
  const slug = generateSlug(normalizedName);

  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(organizations)
    .values({ name: normalizedName, slug })
    .onConflictDoNothing()
    .returning();

  if (created) return created.id;

  const raceExisting = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
    columns: { id: true },
  });
  return raceExisting!.id;
}

/**
 * Resolves a location by raw name.
 *
 * 1. Normalizes the name using Batch 1 normalizeLocation (produces slug)
 * 2. Looks up existing location by slug
 * 3. If not found, creates a new location (defaults to type CITY)
 * 4. Returns the location ID, or null if input normalizes to empty
 */
export async function resolveLocation(
  name: string,
): Promise<string | null> {
  const slug = normalizeLocation(name);
  if (!slug) return null;

  const existing = await db.query.locations.findFirst({
    where: eq(locations.slug, slug),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const normalizedName = normalizeOrganization(name);

  const [created] = await db
    .insert(locations)
    .values({ name: normalizedName, slug, type: "CITY" })
    .onConflictDoNothing()
    .returning();

  if (created) return created.id;

  const raceExisting = await db.query.locations.findFirst({
    where: eq(locations.slug, slug),
    columns: { id: true },
  });
  return raceExisting!.id;
}

/**
 * Resolves a profession by raw name.
 *
 * 1. Normalizes the name using Batch 1 normalizeOrganization
 * 2. Generates a deterministic slug
 * 3. Looks up existing profession by slug
 * 4. If not found, creates a new profession
 * 5. Returns the profession ID
 */
export async function resolveProfession(name: string): Promise<string> {
  const normalizedName = normalizeOrganization(name);
  const slug = generateSlug(normalizedName);

  const existing = await db.query.professions.findFirst({
    where: eq(professions.slug, slug),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(professions)
    .values({ name: normalizedName, slug })
    .onConflictDoNothing()
    .returning();

  if (created) return created.id;

  const raceExisting = await db.query.professions.findFirst({
    where: eq(professions.slug, slug),
    columns: { id: true },
  });
  return raceExisting!.id;
}

/**
 * Resolves a category by raw name.
 *
 * 1. Normalizes the name using Batch 1 normalizeOrganization
 * 2. Generates a deterministic slug
 * 3. Looks up existing category by slug
 * 4. If not found, creates a new category
 * 5. Returns the category ID
 */
export async function resolveCategory(name: string): Promise<string> {
  const normalizedName = normalizeOrganization(name);
  const slug = generateSlug(normalizedName);

  const existing = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(categories)
    .values({ name: normalizedName, slug })
    .onConflictDoNothing()
    .returning();

  if (created) return created.id;

  const raceExisting = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    columns: { id: true },
  });
  return raceExisting!.id;
}
