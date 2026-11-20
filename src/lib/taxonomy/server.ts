import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema/categories";
import { professions } from "@/db/schema/professions";
import { locations } from "@/db/schema/locations";

export type TaxonomyOption = {
  id: string;
  name: string;
};

export type ActiveTaxonomyOptions = {
  categories: TaxonomyOption[];
  professions: TaxonomyOption[];
  locations: TaxonomyOption[];
};

export async function listActiveTaxonomyOptions(
  limit = 200,
): Promise<ActiveTaxonomyOptions> {
  const [categoryOptions, professionOptions, locationOptions] =
    await Promise.all([
      db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(desc(categories.createdAt))
        .limit(limit),
      db
        .select({ id: professions.id, name: professions.name })
        .from(professions)
        .where(eq(professions.isActive, true))
        .orderBy(desc(professions.createdAt))
        .limit(limit),
      db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(eq(locations.isActive, true))
        .orderBy(desc(locations.createdAt))
        .limit(limit),
    ]);

  return {
    categories: categoryOptions,
    professions: professionOptions,
    locations: locationOptions,
  };
}
