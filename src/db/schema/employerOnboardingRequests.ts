import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { employerOnboardingRequestStatusEnum } from "./enums";
import { locations } from "./locations";
import { users } from "./users";

export const employerOnboardingRequests = pgTable(
  "employer_onboarding_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: text("organization_name").notNull(),
    organizationSlug: text("organization_slug").notNull(),
    industry: text("industry"),
    description: text("description"),
    websiteUrl: text("website_url"),
    contactPhone: text("contact_phone"),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    status: employerOnboardingRequestStatusEnum("status")
      .notNull()
      .default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("employer_onboarding_requests_organization_slug_unique").on(
      t.organizationSlug,
    ),
    index("employer_onboarding_requests_user_id_idx").on(t.userId),
    index("employer_onboarding_requests_status_idx").on(t.status),
    index("employer_onboarding_requests_created_at_idx").on(t.createdAt),
  ],
);