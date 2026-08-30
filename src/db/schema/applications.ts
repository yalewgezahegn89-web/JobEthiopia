import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { applicationStatusEnum } from "./enums";
import { jobs } from "./jobs";
import { users } from "./users";

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    candidateUserId: uuid("candidate_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("SUBMITTED"),
    coverLetter: text("cover_letter"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("applications_job_id_candidate_user_id_unique").on(
      t.jobId,
      t.candidateUserId,
    ),
    index("applications_candidate_user_id_created_at_idx").on(
      t.candidateUserId,
      t.createdAt,
    ),
    index("applications_job_id_status_idx").on(t.jobId, t.status),
  ]
);