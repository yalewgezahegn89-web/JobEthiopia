import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * One row per email verification token issuance.
 *
 * Covers both initial email verification and email-change verification.
 * The `email` column stores the email address being verified (the user's
 * current email for initial verification, or the new target email for a change).
 * Only a secure hash of the token is stored (token_hash), never the raw token.
 * consumed_at marks when the token was used; NULL means pending.
 * expires_at bounds how long the token is valid.
 */
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("email_verifications_token_hash_unique").on(t.tokenHash),
    index("email_verifications_user_id_idx").on(t.userId),
    index("email_verifications_expires_at_idx").on(t.expiresAt),
  ],
);