import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { candidateCvs } from "./candidateCvs";

export const candidateCvCertifications = pgTable(
  "candidate_cv_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvId: uuid("cv_id")
      .notNull()
      .references(() => candidateCvs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer").notNull(),
    issuedMonth: text("issued_month").notNull(),
    credentialUrl: text("credential_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("candidate_cv_certifications_cv_id_idx").on(t.cvId)],
);