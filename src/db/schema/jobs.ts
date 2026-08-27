import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  employmentTypeEnum,
  salaryPeriodEnum,
  jobStatusEnum,
  verificationStatusEnum,
} from "./enums";
import { organizations } from "./organizations";
import { categories } from "./categories";
import { professions } from "./professions";
import { locations } from "./locations";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    professionId: uuid("profession_id").references(() => professions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),

    description: text("description").notNull(),
    responsibilities: text("responsibilities"),
    requirements: text("requirements"),
    educationRequirements: text("education_requirements"),
    benefits: text("benefits"),

    experienceMin: integer("experience_min"),
    experienceMax: integer("experience_max"),

    employmentType: employmentTypeEnum("employment_type"),

    salaryMin: numeric("salary_min"),
    salaryMax: numeric("salary_max"),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: salaryPeriodEnum("salary_period"),

    postedAt: timestamp("posted_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),

    applicationUrl: text("application_url"),

    status: jobStatusEnum("status").notNull().default("DRAFT"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("PENDING"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("jobs_status_idx").on(t.status),
    index("jobs_deadline_idx").on(t.deadline),
    index("jobs_posted_at_idx").on(t.postedAt),
    index("jobs_organization_id_idx").on(t.organizationId),
    index("jobs_category_id_idx").on(t.categoryId),
    index("jobs_profession_id_idx").on(t.professionId),
    index("jobs_location_id_idx").on(t.locationId),
    index("jobs_employment_type_idx").on(t.employmentType),
    uniqueIndex("jobs_slug_unique").on(t.slug),
    check("jobs_salary_min_non_negative", sql`${t.salaryMin} >= 0`),
    check("jobs_salary_max_non_negative", sql`${t.salaryMax} >= 0`),
    check("jobs_experience_min_non_negative", sql`${t.experienceMin} >= 0`),
    check("jobs_experience_max_non_negative", sql`${t.experienceMax} >= 0`),
    check("jobs_salary_max_gte_min", sql`${t.salaryMin} IS NULL OR ${t.salaryMax} IS NULL OR ${t.salaryMax} >= ${t.salaryMin}`),
    check("jobs_experience_max_gte_min", sql`${t.experienceMin} IS NULL OR ${t.experienceMax} IS NULL OR ${t.experienceMax} >= ${t.experienceMin}`),
  ]
);
