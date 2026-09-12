import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Candidate-owned CV (Batch 9 — Career / CV tools).
 *
 * One reusable CV per candidate (unique on candidate_id). Implicit reads and
 * mutations are scoped to the server-resolved session candidate id; there is no
 * public or cross-user query surface. Identity fields (name, email) come from
 * the user account and are never stored or editable here.
 */
export const candidateCvs = pgTable(
  "candidate_cvs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    professionalSummary: text("professional_summary"),
    phone: text("phone"),
    location: text("location"),
    websiteUrl: text("website_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("candidate_cvs_candidate_id_unique").on(t.candidateId),
  ]
);