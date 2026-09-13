import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Persistent in-app notification inbox for authenticated users.
 *
 * Each row is a single notification scoped to one user. The `type` column
 * identifies the event category (e.g. "application_status_changed").
 * The `data` column holds minimal display context as JSONB — never secrets,
 * never full entity payloads. The UI resolves display text from `type`
 * via the localization dictionary.
 *
 * `read_at` is NULL when unread; set to the consumption timestamp on read.
 * `action_url` is a relative path for deep-linking (e.g. "/applications/abc").
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data"),
    actionUrl: text("action_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("notifications_user_id_unread_idx")
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
  ],
);
