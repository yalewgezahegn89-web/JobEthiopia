import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { categories } from "./categories";
import { professions } from "./professions";
import { locations } from "./locations";
import {
  employmentTypeEnum,
  alertFrequencyEnum,
  alertStatusEnum,
} from "./enums";

export const jobAlerts = pgTable(
  "job_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keywords: text("keywords"),

    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    professionId: uuid("profession_id").references(() => professions.id, {
      onDelete: "set null",
    }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    employmentType: employmentTypeEnum("employment_type"),

    frequency: alertFrequencyEnum("frequency").notNull().default("DAILY"),
    locale: text("locale").notNull().default("en"),
    status: alertStatusEnum("status").notNull().default("ACTIVE"),

    unsubscribeTokenHash: text("unsubscribe_token_hash"),
    unsubscribeTokenExpiresAt: timestamp("unsubscribe_token_expires_at", {
      withTimezone: true,
    }),

    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("job_alerts_user_id_idx").on(t.userId),
    index("job_alerts_status_frequency_idx").on(t.status, t.frequency),
    index("job_alerts_last_sent_at_idx").on(t.lastSentAt),
    uniqueIndex("job_alerts_unsubscribe_token_hash_unique").on(
      t.unsubscribeTokenHash,
    ),
  ],
);