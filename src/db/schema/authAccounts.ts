import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { authProviderEnum } from "./enums";

/**
 * One row per authentication method linked to a local JobEthiopia user.
 *
 * A single user may authenticate through multiple providers (phone, password,
 * google, apple, telegram). This keeps provider-specific data out of the
 * users table and lets each verified identity link to exactly one local user.
 *
 * Unique provider identity is enforced by
 * (provider, provider_account_id). For the phone provider, provider_account_id
 * is the canonical E.164 number, which also makes each verified phone unique
 * across the platform.
 */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("auth_accounts_provider_provider_account_id_unique").on(
      t.provider,
      t.providerAccountId,
    ),
    index("auth_accounts_user_id_idx").on(t.userId),
  ],
);
