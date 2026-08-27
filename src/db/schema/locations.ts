import {
  pgTable,
  uuid,
  text,
  boolean,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { locationTypeEnum } from "./enums";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    type: locationTypeEnum("type").notNull(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => locations.id, {
      onDelete: "set null",
    }),
    latitude: decimal("latitude"),
    longitude: decimal("longitude"),
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
    index("locations_type_idx").on(t.type),
    index("locations_parent_id_idx").on(t.parentId),
    index("locations_is_active_idx").on(t.isActive),
    uniqueIndex("locations_slug_unique").on(t.slug),
  ]
);
