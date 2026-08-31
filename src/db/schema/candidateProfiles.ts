import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { locations } from "./locations";

export const candidateProfiles = pgTable(
  "candidate_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone"),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    professionalSummary: text("professional_summary"),
    totalExperienceYears: integer("total_experience_years"),
    education: text("education"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("candidate_profiles_candidate_id_unique").on(t.candidateId),
    index("candidate_profiles_location_id_idx").on(t.locationId),
    check(
      "candidate_profiles_total_experience_years_non_negative",
      sql`${t.totalExperienceYears} IS NULL OR ${t.totalExperienceYears} >= 0`,
    ),
    check(
      "candidate_profiles_total_experience_years_max",
      sql`${t.totalExperienceYears} IS NULL OR ${t.totalExperienceYears} <= 60`,
    ),
  ]
);
