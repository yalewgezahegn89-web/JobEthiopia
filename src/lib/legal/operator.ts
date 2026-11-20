/**
 * Public operator details for the legal pages.
 *
 * These values are supplied by the site operator and are shared by the
 * privacy policy, terms of use, and cookie policy. Keep them limited to
 * information that is intentionally public.
 */
export const LEGAL_OPERATOR = {
  name: "Yalew Abera",
  email: "jobethiopiaet@gmail.com",
  website: "https://jobethiopia.et",
  /** ISO date used as the policy effective date and sitemap lastModified. */
  effectiveDate: "2026-11-19",
  googleAdsSettings: "https://adssettings.google.com/",
  aboutAdsChoices: "https://www.aboutads.info/choices/",
} as const;

export function mailtoOperator(): string {
  return `mailto:${LEGAL_OPERATOR.email}`;
}
