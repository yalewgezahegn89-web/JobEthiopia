import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * One row per phone OTP issuance.
 *
 * Only a secure hash of the OTP is stored (otp_hash), never the raw code.
 * userId is nullable so a phone can be verified before a local account exists
 * (pre-account verification). Attempts is a per-record bounded retry counter
 * and expiresAt bounds how long an OTP is valid.
 *
 * A successfully verified phone is linked to a user as an auth_accounts row
 * with provider = "phone"; the auth_accounts unique constraint is what makes a
 * verified phone identity globally unique. Multiple verification rows per
 * phone may legitimately exist across separate OTP requests.
 */
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    phoneNumber: text("phone_number").notNull(),
    otpHash: text("otp_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("phone_verifications_phone_number_idx").on(t.phoneNumber),
    index("phone_verifications_user_id_idx").on(t.userId),
    index("phone_verifications_expires_at_idx").on(t.expiresAt),
  ],
);
