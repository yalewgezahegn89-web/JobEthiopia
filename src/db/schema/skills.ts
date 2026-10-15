import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normalizedKey: text("normalized_key").notNull(),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("skills_normalized_key_unique").on(t.normalizedKey),
    index("skills_category_idx").on(t.category),
    index("skills_is_active_idx").on(t.isActive),
  ]
);
