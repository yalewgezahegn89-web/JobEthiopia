import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import {
  locations,
  organizations,
  categories,
  professions,
  sources,
  jobs,
} from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log("Seeding database...");

  // Locations
  const [ethiopia] = await db
    .insert(locations)
    .values({
      name: "Ethiopia",
      slug: "ethiopia",
      type: "COUNTRY",
    })
    .onConflictDoNothing()
    .returning();

  let ethiopiaId = ethiopia?.id;
  if (!ethiopiaId) {
    const existing = await db.query.locations.findFirst({
      where: (locs, { eq }) => eq(locs.slug, "ethiopia"),
    });
    ethiopiaId = existing!.id;
  }

  const [addisAbaba] = await db
    .insert(locations)
    .values({
      name: "Addis Ababa",
      slug: "addis-ababa",
      type: "CITY",
      parentId: ethiopiaId,
    })
    .onConflictDoNothing()
    .returning();

  let addisAbabaId = addisAbaba?.id;
  if (!addisAbabaId) {
    const existing = await db.query.locations.findFirst({
      where: (locs, { eq }) => eq(locs.slug, "addis-ababa"),
    });
    addisAbabaId = existing!.id;
  }

  await db
    .insert(locations)
    .values({
      name: "Hawassa",
      slug: "hawassa",
      type: "CITY",
      parentId: ethiopiaId,
    })
    .onConflictDoNothing()
    .returning();

  console.log("Locations seeded.");

  // Categories
  const [healthcare] = await db
    .insert(categories)
    .values({
      name: "Healthcare",
      slug: "healthcare",
      description: "Healthcare and medical jobs",
      sortOrder: 1,
    })
    .onConflictDoNothing()
    .returning();

  let healthcareId = healthcare?.id;
  if (!healthcareId) {
    const existing = await db.query.categories.findFirst({
      where: (cats, { eq }) => eq(cats.slug, "healthcare"),
    });
    healthcareId = existing!.id;
  }

  console.log("Categories seeded.");

  // Professions
  const [nursing] = await db
    .insert(professions)
    .values({
      name: "Nursing",
      slug: "nursing",
      description: "Nursing and patient care",
      categoryId: healthcareId,
    })
    .onConflictDoNothing()
    .returning();

  let nursingId = nursing?.id;
  if (!nursingId) {
    const existing = await db.query.professions.findFirst({
      where: (profs, { eq }) => eq(profs.slug, "nursing"),
    });
    nursingId = existing!.id;
  }

  console.log("Professions seeded.");

  // Organizations
  const [blackLion] = await db
    .insert(organizations)
    .values({
      name: "Black Lion Hospital",
      slug: "black-lion-hospital",
      description: "Referral and teaching hospital in Addis Ababa",
      industry: "Healthcare",
      locationId: addisAbabaId,
    })
    .onConflictDoNothing()
    .returning();

  let blackLionId = blackLion?.id;
  if (!blackLionId) {
    const existing = await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.slug, "black-lion-hospital"),
    });
    blackLionId = existing!.id;
  }

  console.log("Organizations seeded.");

  // Sources
  const [manualSource] = await db
    .insert(sources)
    .values({
      name: "Manual Entry",
      sourceType: "MANUAL",
      trustLevel: "HIGH",
    })
    .onConflictDoNothing()
    .returning();

  let manualSourceId = manualSource?.id;
  if (!manualSourceId) {
    const existing = await db.query.sources.findFirst({
      where: (srcs, { eq }) => eq(srcs.name, "Manual Entry"),
    });
    manualSourceId = existing!.id;
  }

  console.log("Sources seeded.");

  // Jobs
  await db
    .insert(jobs)
    .values({
      title: "Staff Nurse",
      slug: "staff-nurse-black-lion",
      organizationId: blackLionId,
      categoryId: healthcareId,
      professionId: nursingId,
      locationId: addisAbabaId,
      description:
        "We are looking for qualified nurses to join our team at Black Lion Hospital. The role involves patient care, medication administration, and collaboration with medical staff.",
      requirements:
        "Valid nursing license, 1+ years of clinical experience, strong communication skills.",
      educationRequirements: "Bachelor of Science in Nursing or equivalent.",
      experienceMin: 1,
      experienceMax: 3,
      employmentType: "FULL_TIME",
      status: "DRAFT",
    })
    .onConflictDoNothing()
    .returning();

  console.log("Jobs seeded.");
  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
