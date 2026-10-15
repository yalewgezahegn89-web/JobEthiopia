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
  careerArticles,
} from "./schema";
import {
  EMPLOYER_SOURCE_NAME,
  API_KEY_SOURCE_NAME,
} from "../lib/sources/provenance";

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

  await db
    .insert(locations)
    .values({
      name: "Semera",
      slug: "semera",
      type: "CITY",
      parentId: ethiopiaId,
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(locations)
    .values({
      name: "Konso",
      slug: "konso",
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

  const [operationsAdministration] = await db
    .insert(categories)
    .values({
      name: "Operations & Administration",
      slug: "operations-administration",
      description: "Operations, administration, and general support roles",
    })
    .onConflictDoNothing()
    .returning();

  let operationsAdministrationId = operationsAdministration?.id;
  if (!operationsAdministrationId) {
    const existing = await db.query.categories.findFirst({
      where: (cats, { eq }) => eq(cats.slug, "operations-administration"),
    });
    operationsAdministrationId = existing!.id;
  }

  const [financeEconomics] = await db
    .insert(categories)
    .values({
      name: "Finance & Economics",
      slug: "finance-economics",
      description: "Finance, accounting, and economic policy roles",
    })
    .onConflictDoNothing()
    .returning();

  let financeEconomicsId = financeEconomics?.id;
  if (!financeEconomicsId) {
    const existing = await db.query.categories.findFirst({
      where: (cats, { eq }) => eq(cats.slug, "finance-economics"),
    });
    financeEconomicsId = existing!.id;
  }

  const [transportLogistics] = await db
    .insert(categories)
    .values({
      name: "Transport & Logistics",
      slug: "transport-logistics",
      description: "Transport, logistics, and fleet roles",
    })
    .onConflictDoNothing()
    .returning();

  let transportLogisticsId = transportLogistics?.id;
  if (!transportLogisticsId) {
    const existing = await db.query.categories.findFirst({
      where: (cats, { eq }) => eq(cats.slug, "transport-logistics"),
    });
    transportLogisticsId = existing!.id;
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

  const [nutrition] = await db
    .insert(professions)
    .values({
      name: "Nutrition",
      slug: "nutrition",
      description: "Nutrition assessment, counseling, and community support",
      categoryId: healthcareId,
    })
    .onConflictDoNothing()
    .returning();

  let nutritionId = nutrition?.id;
  if (!nutritionId) {
    const existing = await db.query.professions.findFirst({
      where: (profs, { eq }) => eq(profs.slug, "nutrition"),
    });
    nutritionId = existing!.id;
  }

  const [operations] = await db
    .insert(professions)
    .values({
      name: "Operations",
      slug: "operations",
      description: "Operations coordination and administrative support",
      categoryId: operationsAdministrationId,
    })
    .onConflictDoNothing()
    .returning();

  let operationsId = operations?.id;
  if (!operationsId) {
    const existing = await db.query.professions.findFirst({
      where: (profs, { eq }) => eq(profs.slug, "operations"),
    });
    operationsId = existing!.id;
  }

  const [publicFinanceEconomicPolicy] = await db
    .insert(professions)
    .values({
      name: "Public Finance / Economic Policy",
      slug: "public-finance-economic-policy",
      description: "Public finance management and economic policy analysis",
      categoryId: financeEconomicsId,
    })
    .onConflictDoNothing()
    .returning();

  let publicFinanceEconomicPolicyId = publicFinanceEconomicPolicy?.id;
  if (!publicFinanceEconomicPolicyId) {
    const existing = await db.query.professions.findFirst({
      where: (profs, { eq }) => eq(profs.slug, "public-finance-economic-policy"),
    });
    publicFinanceEconomicPolicyId = existing!.id;
  }

  const [driver] = await db
    .insert(professions)
    .values({
      name: "Driver",
      slug: "driver",
      description: "Professional driving and fleet operations",
      categoryId: transportLogisticsId,
    })
    .onConflictDoNothing()
    .returning();

  let driverId = driver?.id;
  if (!driverId) {
    const existing = await db.query.professions.findFirst({
      where: (profs, { eq }) => eq(profs.slug, "driver"),
    });
    driverId = existing!.id;
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

  // Employer Portal source (provides provenance for employer-created jobs)
  const [employerSource] = await db
    .insert(sources)
    .values({
      name: EMPLOYER_SOURCE_NAME,
      sourceType: "EMPLOYER",
      trustLevel: "HIGH",
    })
    .onConflictDoNothing()
    .returning();

  let employerSourceId = employerSource?.id;
  if (!employerSourceId) {
    const existing = await db.query.sources.findFirst({
      where: (srcs, { eq }) => eq(srcs.name, EMPLOYER_SOURCE_NAME),
    });
    employerSourceId = existing!.id;
  }

  // API Key source (provides provenance for API-key created jobs)
  const [apiKeySource] = await db
    .insert(sources)
    .values({
      name: API_KEY_SOURCE_NAME,
      sourceType: "API",
      trustLevel: "HIGH",
    })
    .onConflictDoNothing()
    .returning();

  let apiKeySourceId = apiKeySource?.id;
  if (!apiKeySourceId) {
    const existing = await db.query.sources.findFirst({
      where: (srcs, { eq }) => eq(srcs.name, API_KEY_SOURCE_NAME),
    });
    apiKeySourceId = existing!.id;
  }

  console.log("Provisioned sources seeded.");

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

  // Career Articles
  await db
    .insert(careerArticles)
    .values({
      title: "How to Write a Professional CV",
      slug: "how-to-write-a-professional-cv",
      excerpt: "Tips for crafting a standout CV for the Ethiopian job market",
      content:
        "A well-written CV is your first opportunity to make a great impression. This guide covers formatting, content, and tailoring your CV for specific roles in Ethiopia.",
      category: "Career Tips",
      status: "PUBLISHED",
      publishedAt: new Date("2026-01-20"),
    })
    .onConflictDoNothing()
    .returning();

  console.log("Career Articles seeded.");
  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
