import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";
import { users } from "./users";
import { facebookPublicationStateEnum } from "./enums";

/**
 * Durable record of manual publications to the JobEthiopia-owned Facebook
 * Page (administrator-triggered only).
 *
 * One row per (job, owned Page). The unique index is the primary
 * duplicate-post defence: a job can never be published twice to the
 * JobEthiopia Page. A row is claimed (`PENDING`) before the Graph API call
 * and advanced to a terminal state afterwards. `UNKNOWN` marks an ambiguous
 * network outcome and is never retried automatically — a repeat POST could
 * create a duplicate published post. Access tokens are never stored here.
 */
export const facebookPublications = pgTable(
  "facebook_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /** The owned Page ID this attempt targeted (always the JobEthiopia Page). */
    pageId: text("page_id").notNull(),
    state: facebookPublicationStateEnum("state").notNull().default("PENDING"),
    /** Remote Facebook post id, recorded only after a confirmed success. */
    facebookPostId: text("facebook_post_id"),
    /** Administrator who requested the publication (from the session only). */
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Sanitized, credential-free error description. */
    lastError: text("last_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("facebook_publications_job_page_unique").on(t.jobId, t.pageId),
    index("facebook_publications_state_idx").on(t.state),
  ],
);
