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
]);

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
