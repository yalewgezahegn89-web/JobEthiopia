import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { jobs } from "./jobs";
import { telegramPublicationStateEnum } from "./enums";

/**
 * Durable Telegram outbox.
 *
 * One row per (job, channel). The unique index guarantees a job can never be
 * enqueued twice for the same channel, which is the primary duplicate-post
 * defence. Delivery state is advanced by the protected worker.
 */
export const telegramPublications = pgTable(
  "telegram_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    state: telegramPublicationStateEnum("state").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    telegramMessageId: text("telegram_message_id"),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("telegram_publications_job_channel_unique").on(
      t.jobId,
      t.channel,
    ),
    index("telegram_publications_state_next_retry_idx").on(
      t.state,
      t.nextRetryAt,
    ),
    check("telegram_publications_attempts_non_negative", sql`${t.attempts} >= 0`),
    check(
      "telegram_publications_max_attempts_positive",
      sql`${t.maxAttempts} > 0`,
    ),
  ],
);
