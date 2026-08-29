import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizationStatusEnum } from "./enums";
import { locations } from "./locations";
import { users } from "./users";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    industry: text("industry"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    isVerified: boolean("is_verified").notNull().default(false),
    status: organizationStatusEnum("status").notNull().default("ACTIVE"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verificationNotes: text("verification_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("organizations_status_idx").on(t.status),
    index("organizations_location_id_idx").on(t.locationId),
    uniqueIndex("organizations_slug_unique").on(t.slug),
  ]
);
