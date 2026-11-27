import { pgEnum } from "drizzle-orm/pg-core";

export const organizationStatusEnum = pgEnum("organization_status", [
  "ACTIVE",
  "INACTIVE",
]);

export const locationTypeEnum = pgEnum("location_type", [
  "COUNTRY",
  "REGION",
  "CITY",
  "DISTRICT",
  "OTHER",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "MANUAL",
  "WEBSITE",
  "API",
  "FEED",
  "EMPLOYER",
  "OTHER",
  "FACEBOOK",
]);

/**
 * Facebook Page ownership model.
 *
 * `OWNED_PAGE` is JobEthiopia's own Page (authorized with a Page access
 * token). `EXTERNAL_PAGE` is a third-party Page that may only be monitored
 * after Meta Page Public Content Access approval and a recorded content-use
 * authorization from the Page owner.
 */
export const facebookPageKindEnum = pgEnum("facebook_page_kind", [
  "OWNED_PAGE",
  "EXTERNAL_PAGE",
]);

/** Meta approval state for external Page content access. */
export const facebookApprovalStateEnum = pgEnum("facebook_approval_state", [
  "NOT_REQUESTED",
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

/** Documented Page-owner authorization to use/reproduce job-post content. */
export const facebookContentUseStateEnum = pgEnum(
  "facebook_content_use_state",
  ["NOT_RECORDED", "PENDING", "AUTHORIZED", "DENIED"],
);

export const trustLevelEnum = pgEnum("trust_level", [
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "VOLUNTEER",
  "FREELANCE",
  "OTHER",
]);

export const salaryPeriodEnum = pgEnum("salary_period", [
  "HOURLY",
  "DAILY",
  "MONTHLY",
  "YEARLY",
  "OTHER",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "EXPIRED",
  "REMOVED",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "PENDING",
  "VERIFIED",
  "NEEDS_REVIEW",
  "INVALID",
]);

/**
 * Explicit applicant-eligibility statement for a vacancy.
 *
 * Stored separately from prose so the platform never implies Ethiopian
 * eligibility unless the official vacancy says so. `NOT_STATED` is the
 * conservative default and must be used when the source is silent.
 */
export const applicantEligibilityEnum = pgEnum("applicant_eligibility", [
  "ETHIOPIAN_APPLICANTS_CONFIRMED",
  "INTERNATIONAL_APPLICANTS_ACCEPTED",
  "LOCAL_WORK_AUTHORIZATION_REQUIRED",
  "CITIZENSHIP_RESTRICTED",
  "NOT_STATED",
]);

export const telegramPublicationStateEnum = pgEnum(
  "telegram_publication_state",
  ["QUEUED", "SENDING", "RETRY", "SENT", "FAILED", "SKIPPED"],
);

/**
 * Durable state of a manual Facebook Page publication attempt.
 *
 * `PENDING` — the record is claimed and the Graph API call is in flight.
 * `PUBLISHED` — Facebook confirmed the post (remote post id recorded).
 * `FAILED` — Facebook definitively rejected the post (no post was created).
 * `UNKNOWN` — the outcome is ambiguous (e.g. network timeout); the post may
 * exist, so the attempt is never retried automatically.
 */
export const facebookPublicationStateEnum = pgEnum(
  "facebook_publication_state",
  ["PENDING", "PUBLISHED", "FAILED", "UNKNOWN"],
);

export const articleStatusEnum = pgEnum("article_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const userRoleEnum = pgEnum("user_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ORGANIZATION_ADMIN",
  "CANDIDATE",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "SUBMITTED",
  "WITHDRAWN",
  "REVIEWING",
  "SHORTLISTED",
  "REJECTED",
]);

export const employerOnboardingRequestStatusEnum = pgEnum(
  "employer_onboarding_request_status",
  ["PENDING", "APPROVED", "REJECTED"],
);

export const authProviderEnum = pgEnum("auth_provider", [
  "password",
  "phone",
  "google",
  "apple",
  "telegram",
]);

export const alertFrequencyEnum = pgEnum("alert_frequency", [
  "INSTANT",
  "DAILY",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "ACTIVE",
  "PAUSED",
  "UNSUBSCRIBED",
  "DISABLED",
]);

export const alertDeliveryStatusEnum = pgEnum("alert_delivery_status", [
  "SENT",
  "SKIPPED_NO_EMAIL",
  "FAILED",
]);
