import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * One row per failed login attempt.
 *
 * Used for sliding-window account lockout. The `account_key` is a SHA-256
 * hash of the normalized email (identifier-hashed); plaintext email is
 * NEVER stored. The `ip` column is informational only and not used as
 * the lockout identity. Lockout is evaluated per account_key over a
 * sliding time window (e.g., 15 minutes).
 *
 * Rows are inserted on login failure; a successful login deletes rows
 * for that account_key. Maintenance reaps rows older than 24 hours.
 */
export const loginFailures = pgTable(
  "login_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountKey: text("account_key").notNull(),
    ip: text("ip"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("login_failures_account_key_attempted_at_idx").on(
      t.accountKey,
      t.attemptedAt,
    ),
  ],
);