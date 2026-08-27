import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sourceTypeEnum, trustLevelEnum } from "./enums";

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    baseUrl: text("base_url"),
    isActive: boolean("is_active").notNull().default(true),
    trustLevel: trustLevelEnum("trust_level").notNull().default("MEDIUM"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sources_source_type_idx").on(t.sourceType),
    index("sources_is_active_idx").on(t.isActive),
    uniqueIndex("sources_name_unique").on(t.name),
  ]
);
