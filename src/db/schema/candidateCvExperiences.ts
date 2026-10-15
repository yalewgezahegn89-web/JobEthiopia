import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { candidateCvs } from "./candidateCvs";

/**
 * CV experience entries (Batch 9).
 * Months are stored as `YYYY-MM` text validated against a strict regex and
 * sanity range at the application layer; lexical comparison is therefore safe
 * for start <= end ordering checks.
 */
export const candidateCvExperiences = pgTable(
  "candidate_cv_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvId: uuid("cv_id")
      .notNull()
      .references(() => candidateCvs.id, { onDelete: "cascade" }),
    employer: text("employer").notNull(),
    role: text("role").notNull(),
    location: text("location"),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("candidate_cv_experiences_cv_id_idx").on(t.cvId)],
);