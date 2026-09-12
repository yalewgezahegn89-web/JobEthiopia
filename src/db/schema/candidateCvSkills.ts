import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { candidateCvs } from "./candidateCvs";

export const candidateCvSkills = pgTable(
  "candidate_cv_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvId: uuid("cv_id")
      .notNull()
      .references(() => candidateCvs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: text("level"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("candidate_cv_skills_cv_id_idx").on(t.cvId),
    uniqueIndex("candidate_cv_skills_cv_id_name_unique").on(t.cvId, t.name),
  ]
);