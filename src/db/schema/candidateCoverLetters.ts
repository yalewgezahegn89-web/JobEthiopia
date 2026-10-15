import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { jobs } from "./jobs";

/**
 * Candidate-owned cover letter (Phase 13 — Career Tools).
 *
 * A cover letter belongs strictly to one candidate; every read and mutation is
 * scoped to the server-resolved session candidate id, and there is no public
 * or cross-user query surface. `jobId` is an optional reference to the vacancy
 * the letter was created for — used for prefill/reuse and removed on job
 * deletion — never a source of truth for job facts. Identity (name, email)
 * comes from the user account and is never stored here.
 */
export const candidateCoverLetters = pgTable(
  "candidate_cover_letters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    position: text("position").notNull(),
    employer: text("employer").notNull(),
    recipient: text("recipient"),
    location: text("location"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("candidate_cover_letters_candidate_updated_idx").on(
      t.candidateId,
      t.updatedAt,
    ),
    index("candidate_cover_letters_job_id_idx").on(t.jobId),
  ]
);