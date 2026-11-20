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
import {
  sourceTypeEnum,
  trustLevelEnum,
  facebookPageKindEnum,
  facebookApprovalStateEnum,
  facebookContentUseStateEnum,
} from "./enums";

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    baseUrl: text("base_url"),
    isActive: boolean("is_active").notNull().default(true),
    trustLevel: trustLevelEnum("trust_level").notNull().default("MEDIUM"),
    /**
     * Explicit opt-in for automatic publication. Never inferred from
     * trustLevel: autoPublish must be true AND the source must still pass the
     * publication policy (trusted level, supported type, validation, URLs,
     * deadline and duplicate checks).
     */
    autoPublish: boolean("auto_publish").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    lastSuccessfulCheck: timestamp("last_successful_check", {
      withTimezone: true,
    }),
    lastAttemptedCheck: timestamp("last_attempted_check", {
      withTimezone: true,
    }),
    lastError: text("last_error"),
    checkFrequencyMinutes: integer("check_frequency_minutes"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    /**
     * Facebook Page metadata. Only populated for `FACEBOOK` sources. The Page
     * ID is the stable Graph API identity; the display name lives in `name`
     * and the Page URL in `baseUrl`. Access tokens are NEVER stored here.
     */
    facebookPageId: text("facebook_page_id"),
    facebookPageKind: facebookPageKindEnum("facebook_page_kind"),
    facebookApprovalState: facebookApprovalStateEnum(
      "facebook_approval_state",
    ).default("NOT_REQUESTED"),
    facebookContentUseState: facebookContentUseStateEnum(
      "facebook_content_use_state",
    ).default("NOT_RECORDED"),
    facebookAuthorizationNote: text("facebook_authorization_note"),
  },
  (t) => [
    index("sources_source_type_idx").on(t.sourceType),
    index("sources_is_active_idx").on(t.isActive),
    uniqueIndex("sources_name_unique").on(t.name),
    uniqueIndex("sources_facebook_page_id_unique").on(t.facebookPageId),
  ]
);
