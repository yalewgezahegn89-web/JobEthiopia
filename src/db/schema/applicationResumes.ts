import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { applications } from "./applications";

export const applicationResumes = pgTable(
  "application_resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("application_resumes_application_id_unique").on(t.applicationId),
    check("application_resumes_size_positive", sql`${t.size} > 0`),
    check(
      "application_resumes_size_max",
      sql`${t.size} <= ${5 * 1024 * 1024}`,
    ),
    check(
      "application_resumes_mime_pdf",
      sql`${t.mimeType} = 'application/pdf'`,
    ),
  ]
);
