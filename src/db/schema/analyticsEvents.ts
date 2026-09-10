import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";

/**
 * First-party, server-side discovery analytics (product analytics).
 *
 * Holds only discovery events that cannot be derived from existing tables
 * (`job_viewed`, `job_search`, `job_list_viewed`). Engagement, moderation,
 * ingestion and growth metrics are reported from their source tables
 * (applications, saved_jobs, job_alert_deliveries, audit_log, users, sources).
 *
 * Privacy constraints enforced at the capture layer:
 * - No cookies, no client scripts, no PII (no email/phone/IP/user-agent).
 * - Event names and metadata are server-allowlisted.
 * - `locale` is restricted to the supported site locales (en|am|om).
 * - `metadata` is sanitized and bounded by the capture service.
 * - Rows are pruned by the retention policy (see lib/analytics/retention.ts).
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: text("event").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("analytics_events_created_at_idx").on(t.createdAt),
    index("analytics_events_event_created_at_idx").on(t.event, t.createdAt),
    index("analytics_events_job_id_idx").on(t.jobId),
  ],
);