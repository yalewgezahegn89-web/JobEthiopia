import { z } from "zod";
import { httpUrlSchema } from "./employerJob";
import { normalizePhone } from "./candidateProfile";

/**
 * CV validation (Batch 9 — Career / CV tools).
 *
 * Everything is bounded: field lengths, section item counts, and month values.
 * Unicode is accepted anywhere (Amharic, Afaan Oromoo, and mixed text are all
 * valid); only URL scheme and month shape are restricted. Empty optional
 * strings normalize to null. Section input arrays are filtered to non-empty
 * entries before validation so blank rows are silently ignored.
 */

export const CV_TITLE_MAX = 80;
export const CV_SUMMARY_MAX = 2000;
export const CV_STRING_SHORT_MAX = 120;
export const CV_DESCRIPTION_MAX = 1000;
export const CV_SKILL_NAME_MAX = 60;
export const CV_LEVEL_MAX = 20;
export const CV_PHONE_MAX = 20;
export const CV_LOCATION_MAX = 120;

export const CV_EXPERIENCES_MAX = 10;
export const CV_EDUCATIONS_MAX = 10;
export const CV_SKILLS_MAX = 15;
export const CV_CERTIFICATIONS_MAX = 10;

export const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2099;

export function isValidYearMonth(value: string): boolean {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

export function isEmptyYearMonth(value: string): boolean {
  return value == null || value.trim().length === 0;
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const optionalText = (max: number, message?: string) =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? emptyToNull(v) : v),
      z.string().max(max, message).nullish(),
    );

const requiredText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `${message} (max ${max} characters)`);

const monthSchema = z
  .string()
  .trim()
  .min(1, "A month in YYYY-MM format is required")
  .refine(isValidYearMonth, "Month must be a valid YYYY-MM value");

const monthOptionalSchema = z
  .preprocess(
    (v) => (typeof v === "string" ? emptyToNull(v) : v),
    z.string().refine((v) => isValidYearMonth(v), "Month must be a valid YYYY-MM value").nullish(),
  );

const phoneSchema = z
  .preprocess((v) => (typeof v === "string" ? normalizePhone(v) : v), z.union([z.literal(""), z.string().regex(/^[+]?[0-9]{7,15}$/, "Enter a valid phone number"), z.null()]).nullish())
  .transform(emptyToNull);

const websiteSchema = z
  .preprocess((v) => (typeof v === "string" ? emptyToNull(v) : v), httpUrlSchema.nullish());

const experienceItemSchema = z
  .object({
    employer: requiredText(CV_STRING_SHORT_MAX, "Employer is required"),
    role: requiredText(CV_STRING_SHORT_MAX, "Role is required"),
    location: optionalText(CV_LOCATION_MAX),
    startMonth: monthSchema,
    endMonth: monthOptionalSchema,
    description: optionalText(CV_DESCRIPTION_MAX),
  })
  .strict()
  .refine(
    (item) =>
      item.endMonth == null || item.endMonth >= item.startMonth,
    { message: "End month must not be before the start month", path: ["endMonth"] },
  );

const educationItemSchema = z
  .object({
    institution: requiredText(CV_STRING_SHORT_MAX, "Institution is required"),
    qualification: requiredText(CV_STRING_SHORT_MAX, "Qualification is required"),
    fieldOfStudy: optionalText(CV_STRING_SHORT_MAX),
    startMonth: monthSchema,
    endMonth: monthOptionalSchema,
  })
  .strict()
  .refine(
    (item) =>
      item.endMonth == null || item.endMonth >= item.startMonth,
    { message: "End month must not be before the start month", path: ["endMonth"] },
  );

const skillItemSchema = z
  .object({
    name: requiredText(CV_SKILL_NAME_MAX, "Skill name is required"),
    level: optionalText(CV_LEVEL_MAX),
  })
  .strict();

const certificationItemSchema = z
  .object({
    name: requiredText(CV_STRING_SHORT_MAX, "Certification name is required"),
    issuer: requiredText(CV_STRING_SHORT_MAX, "Issuer is required"),
    issuedMonth: monthSchema,
    credentialUrl: websiteSchema,
  })
  .strict();

const boundedList = <S extends z.ZodType>(schema: S, max: number) =>
  z.array(schema).max(max, `Too many entries (max ${max})`);

export const cvHeaderSchema = z
  .object({
    title: requiredText(CV_TITLE_MAX, "Headline is required"),
    professionalSummary: optionalText(CV_SUMMARY_MAX),
    phone: phoneSchema,
    location: optionalText(CV_LOCATION_MAX),
    websiteUrl: websiteSchema,
  })
  .strict();

export const cvSchema = z
  .object({
    header: cvHeaderSchema,
    experiences: boundedList(experienceItemSchema, CV_EXPERIENCES_MAX).default([]),
    educations: boundedList(educationItemSchema, CV_EDUCATIONS_MAX).default([]),
    skills: boundedList(skillItemSchema, CV_SKILLS_MAX).default([]),
    certifications: boundedList(certificationItemSchema, CV_CERTIFICATIONS_MAX).default([]),
  })
  .strict();

export type CvHeaderInput = z.infer<typeof cvHeaderSchema>;
export type CvExperienceInput = z.infer<typeof experienceItemSchema>;
export type CvEducationInput = z.infer<typeof educationItemSchema>;
export type CvSkillInput = z.infer<typeof skillItemSchema>;
export type CvCertificationInput = z.infer<typeof certificationItemSchema>;

export type CvInput = {
  header: CvHeaderInput;
  experiences: CvExperienceInput[];
  educations: CvEducationInput[];
  skills: CvSkillInput[];
  certifications: CvCertificationInput[];
};

export function parseCvPayload(unknown: unknown) {
  return cvSchema.safeParse(unknown);
}