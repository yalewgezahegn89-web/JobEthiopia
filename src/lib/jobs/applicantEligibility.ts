/**
 * Applicant-eligibility classification for vacancies.
 *
 * The platform must never imply that Ethiopian applicants are eligible unless
 * the official vacancy explicitly says so. Every imported listing therefore
 * carries an explicit, structured eligibility value; anything ambiguous is
 * `NOT_STATED`.
 */
export const APPLICANT_ELIGIBILITY_VALUES = [
  "ETHIOPIAN_APPLICANTS_CONFIRMED",
  "INTERNATIONAL_APPLICANTS_ACCEPTED",
  "LOCAL_WORK_AUTHORIZATION_REQUIRED",
  "CITIZENSHIP_RESTRICTED",
  "NOT_STATED",
] as const;

export type ApplicantEligibility =
  (typeof APPLICANT_ELIGIBILITY_VALUES)[number];

export const DEFAULT_APPLICANT_ELIGIBILITY: ApplicantEligibility = "NOT_STATED";

const ELIGIBILITY_LABELS: Record<
  ApplicantEligibility,
  { en: string; am: string }
> = {
  ETHIOPIAN_APPLICANTS_CONFIRMED: {
    en: "Ethiopian applicants confirmed",
    am: "የኢትዮጵያ አመልካቾች ተፈቅዷል",
  },
  INTERNATIONAL_APPLICANTS_ACCEPTED: {
    en: "International applicants accepted",
    am: "ዓለም አቀፍ አመልካቾች ተቀባይነት አላቸው",
  },
  LOCAL_WORK_AUTHORIZATION_REQUIRED: {
    en: "Local work authorization required",
    am: "የአካባቢ የሥራ ፈቃድ ያስፈልጋል",
  },
  CITIZENSHIP_RESTRICTED: {
    en: "Citizenship restricted",
    am: "ዜግነት የተገደበ",
  },
  NOT_STATED: {
    en: "Eligibility not stated by the employer",
    am: "ተፈቃድ በቀጣሪው አልተገለጸም",
  },
};

export function isApplicantEligibility(
  value: unknown,
): value is ApplicantEligibility {
  return (
    typeof value === "string" &&
    (APPLICANT_ELIGIBILITY_VALUES as readonly string[]).includes(value)
  );
}

/** Parses an unknown value, falling back to the conservative default. */
export function normalizeApplicantEligibility(
  value: unknown,
): ApplicantEligibility {
  return isApplicantEligibility(value) ? value : DEFAULT_APPLICANT_ELIGIBILITY;
}

export function applicantEligibilityLabel(
  value: ApplicantEligibility,
  locale: "en" | "am" = "en",
): string {
  return ELIGIBILITY_LABELS[value][locale];
}

const WORK_AUTHORIZATION_PATTERNS = [
  /authori[sz]ed to work/i,
  /work authori[sz]ation/i,
  /right to work/i,
  /work permit/i,
];

const CITIZENSHIP_PATTERNS = [
  /citizenship (?:is )?(?:required|restricted)/i,
  /only (?:ethiopian )?(?:nationals|citizens)/i,
  /must be (?:an? )?(?:ethiopian )?(?:national|citizen)/i,
  /nationals? of [a-z ]+ only/i,
];

const ETHIOPIAN_PATTERNS = [
  /ethiopian (?:applicants|nationals|citizens)/i,
  /open to ethiopian/i,
  /eligible ethiopian/i,
];

const INTERNATIONAL_PATTERNS = [
  /international applicants/i,
  /applicants from (?:any|all) countries/i,
  /open internationally/i,
  /worldwide applicants/i,
];

/**
 * Classifies eligibility from explicit official text only.
 *
 * The matcher is deliberately narrow: it must see an explicit statement in
 * the supplied text. It never infers eligibility from a job location, an
 * employer's home country, or an absent field.
 */
export function classifyApplicantEligibility(
  ...texts: Array<string | null | undefined>
): ApplicantEligibility {
  const text = texts
    .filter((value): value is string => typeof value === "string")
    .join("\n");

  if (!text.trim()) return DEFAULT_APPLICANT_ELIGIBILITY;

  if (CITIZENSHIP_PATTERNS.some((pattern) => pattern.test(text))) {
    return "CITIZENSHIP_RESTRICTED";
  }
  if (WORK_AUTHORIZATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "LOCAL_WORK_AUTHORIZATION_REQUIRED";
  }
  if (INTERNATIONAL_PATTERNS.some((pattern) => pattern.test(text))) {
    return "INTERNATIONAL_APPLICANTS_ACCEPTED";
  }
  if (ETHIOPIAN_PATTERNS.some((pattern) => pattern.test(text))) {
    return "ETHIOPIAN_APPLICANTS_CONFIRMED";
  }
  return DEFAULT_APPLICANT_ELIGIBILITY;
}

/** Returns true when the deadline is in the past (at or before `now`). */
export function isDeadlineExpired(
  deadline: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;
  const parsed = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}
