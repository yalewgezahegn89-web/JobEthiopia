import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { candidateCvs } from "./candidateCvs";

export const candidateCvEducations = pgTable(
  "candidate_cv_educations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvId: uuid("cv_id")
      .notNull()
      .references(() => candidateCvs.id, { onDelete: "cascade" }),
    institution: text("institution").notNull(),
    qualification: text("qualification").notNull(),
    fieldOfStudy: text("field_of_study"),
    startMonth: text("start_month").notNull(),
    endMonth: text("end_month"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("candidate_cv_educations_cv_id_idx").on(t.cvId)],
);