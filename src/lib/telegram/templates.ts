import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { applicantEligibilityLabel } from "@/lib/jobs/applicantEligibility";
import type { ApplicantEligibility } from "@/lib/jobs/applicantEligibility";
import { formatEmploymentType } from "@/lib/jobs/employmentTypes";

/**
 * English-only structured text for Telegram rendering.
 *
 * Job content comes from the official English vacancy and is never translated
 * or rewritten. The website UI keeps its Amharic and Afaan Oromo localization.
 */
export interface PublicationText {
  title: string;
  organizationName: string;
  locationName: string | null;
  employmentType: string | null;
  eligibility: string;
  deadline: string | null;
  description: string;
  url: string;
}

export interface TelegramJobInput {
  id: string;
  title: string;
  description: string;
  organizationName: string;
  locationName: string | null;
  employmentType: string | null;
  deadline: Date | null;
  applicantEligibility: ApplicantEligibility;
}

const MAX_DESCRIPTION_CHARS = 500;

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value: string): string {
  const text = plainText(value);
  if (text.length <= MAX_DESCRIPTION_CHARS) return text;
  return `${text.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()}...`;
}

function formatDeadline(deadline: Date | null): string | null {
  if (!deadline) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "Africa/Addis_Ababa",
    }).format(deadline);
  } catch {
    return deadline.toISOString().slice(0, 10);
  }
}

export function jobPublicUrl(jobId: string): string {
  return `${getAppBaseUrl().replace(/\/+$/, "")}/jobs/${encodeURIComponent(jobId)}`;
}

/** Builds the English-only structured text before rendering. */
export function buildTelegramPublicationText(
  job: TelegramJobInput,
): PublicationText {
  return {
    title: job.title,
    organizationName: job.organizationName,
    locationName: job.locationName,
    employmentType: job.employmentType
      ? formatEmploymentType(job.employmentType)
      : null,
    eligibility: applicantEligibilityLabel(job.applicantEligibility, "en"),
    deadline: formatDeadline(job.deadline),
    description: excerpt(job.description),
    url: jobPublicUrl(job.id),
  };
}

/** Renders the final English-only Telegram HTML message. */
export function renderTelegramMessage(text: PublicationText): string {
  const lines: string[] = [
    `<b>${escapeTelegramHtml(text.title)}</b>`,
    escapeTelegramHtml(text.organizationName),
  ];

  const details: string[] = [];
  if (text.locationName) details.push(`Location: ${text.locationName}`);
  if (text.employmentType) details.push(`Type: ${text.employmentType}`);
  if (text.deadline) details.push(`Deadline: ${text.deadline}`);
  details.push(`Eligibility: ${text.eligibility}`);
  lines.push(escapeTelegramHtml(details.join(" | ")));

  if (text.description) {
    lines.push(escapeTelegramHtml(text.description));
  }

  lines.push(`<a href="${escapeTelegramHtml(text.url)}">View job and apply</a>`);

  return lines.join("\n\n");
}

export function buildTelegramJobMessage(job: TelegramJobInput): string {
  return renderTelegramMessage(buildTelegramPublicationText(job));
}
