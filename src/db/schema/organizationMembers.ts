import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_unique").on(
      t.organizationId,
      t.userId,
    ),
    index("organization_members_user_id_idx").on(t.userId),
  ],
);
