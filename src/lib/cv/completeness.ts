/**
 * Deterministic CV readiness evaluation (Phase 13 — Career Tools).
 *
 * Pure, explainable, and intentionally NOT an "AI score". Every point comes
 * from one transparent rule. Five scored checks add up to a 100-point scale;
 * certifications are listed as a recommended-but-unscored check so a
 * strong CV without certifications is not penalized. The UI localizes the
 * check keys; this module only produces stable keys and numbers.
 */

export const CV_READINESS_CHECKS = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
] as const;

export type CvReadinessCheckKey = (typeof CV_READINESS_CHECKS)[number];

export type CvReadinessCheck = {
  key: CvReadinessCheckKey;
  satisfied: boolean;
  scored: boolean;
};

export type CvReadinessResult = {
  percent: number;
  complete: boolean;
  missing: CvReadinessCheckKey[];
  checks: CvReadinessCheck[];
};

type CvSectionCounts = {
  experiences: { length: number };
  educations: { length: number };
  skills: { length: number };
  certifications: { length: number };
};

export type CvReadinessSource = {
  hasCv: boolean;
  cv: {
    header: {
      phone: string | null;
      location: string | null;
      professionalSummary: string | null;
    };
  } & CvSectionCounts | null;
  accountEmail: string | null;
  profile: {
    phone: string | null;
  } | null;
};

/** Scored weights sum to 100. */
const SCORED_WEIGHTS: Record<
  Exclude<CvReadinessCheckKey, "certifications">,
  number
> = {
  contact: 15,
  summary: 20,
  experience: 25,
  education: 20,
  skills: 20,
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateCvReadiness(
  input: CvReadinessSource,
): CvReadinessResult {
  const checks: CvReadinessCheck[] = [];

  const contact =
    hasText(input.accountEmail) ||
    hasText(input.cv?.header.phone) ||
    hasText(input.profile?.phone) ||
    hasText(input.cv?.header.location);
  checks.push({ key: "contact", satisfied: contact, scored: true });

  const summary = hasText(input.cv?.header.professionalSummary);
  checks.push({ key: "summary", satisfied: summary, scored: true });

  const experience = (input.cv?.experiences.length ?? 0) > 0;
  checks.push({ key: "experience", satisfied: experience, scored: true });

  const education = (input.cv?.educations.length ?? 0) > 0;
  checks.push({ key: "education", satisfied: education, scored: true });

  const skills = (input.cv?.skills.length ?? 0) > 0;
  checks.push({ key: "skills", satisfied: skills, scored: true });

  const certifications = (input.cv?.certifications.length ?? 0) > 0;
  checks.push({ key: "certifications", satisfied: certifications, scored: false });

  let percent = 0;
  for (const check of checks) {
    if (!check.satisfied) continue;
    if (check.key === "certifications") continue;
    percent += SCORED_WEIGHTS[check.key as keyof typeof SCORED_WEIGHTS];
  }

  const missing = checks
    .filter((c) => c.scored && !c.satisfied)
    .map((c) => c.key as CvReadinessCheckKey);

  return {
    percent,
    complete: missing.length === 0,
    missing,
    checks,
  };
}