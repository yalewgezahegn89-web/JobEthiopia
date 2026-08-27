import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => categories.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("categories_parent_id_idx").on(t.parentId),
    index("categories_is_active_idx").on(t.isActive),
    uniqueIndex("categories_slug_unique").on(t.slug),
  ]
);
