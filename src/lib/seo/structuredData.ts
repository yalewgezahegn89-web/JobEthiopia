import type { PublicArticleDetail } from "@/lib/careerArticles/public";
import {
  DEFAULT_STALE_MAX_AGE_DAYS,
  isJobStale,
  type PublicJobDetail,
} from "@/lib/jobs/public";
import { toIsoDate } from "./metadata";

type JobPostingInput = Pick<
  PublicJobDetail,
  | "title"
  | "description"
  | "postedAt"
  | "deadline"
  | "employmentType"
  | "organizationName"
  | "locationName"
  | "status"
  | "lastVerifiedAt"
>;

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Map internal enum labels to schema.org's expected JobPosting values. */
const EMPLOYMENT_TYPE_LD: Record<string, string> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  TEMPORARY: "TEMPORARY",
  INTERNSHIP: "INTERN",
  VOLUNTEER: "VOLUNTEER",
  FREELANCE: "CONTRACTOR",
  OTHER: "OTHER",
};

function isPublicJob(job: JobPostingInput, now: Date): boolean {
  if (job.status && job.status !== "PUBLISHED") return false;
  if (!job.lastVerifiedAt) return false;
  if (
    isJobStale(
      job.lastVerifiedAt,
      DEFAULT_STALE_MAX_AGE_DAYS,
      now,
    )
  ) {
    return false;
  }

  const deadline = toIsoDate(job.deadline);
  if (deadline && new Date(deadline).getTime() < now.getTime()) return false;

  return true;
}

/**
 * Builds JobPosting JSON-LD from fields the public API actually provides.
 * Salary, application contact details, and unverified employer details are
 * intentionally omitted instead of inferred.
 */
export function buildJobPostingLd(
  job: JobPostingInput,
  canonicalUrl: string,
  now: Date = new Date(),
): Record<string, unknown> | null {
  if (
    !hasText(job.title) ||
    !hasText(job.description) ||
    !hasText(job.employmentType) ||
    !hasText(job.organizationName) ||
    !hasText(job.locationName)
  ) {
    return null;
  }
  if (!isPublicJob(job, now)) return null;

  const datePosted = toIsoDate(job.postedAt);
  const validThrough = toIsoDate(job.deadline);
  if (!datePosted || !validThrough) return null;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    url: canonicalUrl,
    ...(datePosted ? { datePosted } : {}),
    ...(validThrough ? { validThrough } : {}),
    ...(hasText(job.employmentType)
      ? {
          employmentType:
            EMPLOYMENT_TYPE_LD[job.employmentType] ?? job.employmentType,
        }
      : {}),
    ...(hasText(job.organizationName)
      ? {
          hiringOrganization: {
            "@type": "Organization",
            name: job.organizationName,
          },
        }
      : {}),
    ...(hasText(job.locationName)
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.locationName,
            },
          },
        }
      : {}),
  };
}

/**
 * Article JSON-LD is emitted only for a published article with a usable
 * publication date. No author, image, or modification date is invented.
 */
export function buildArticleLd(
  article: Pick<
    PublicArticleDetail,
    "title" | "excerpt" | "status" | "category"
  > & {
    publishedAt?: string | null;
    publishedAtIso?: string | null;
  },
  canonicalUrl: string,
): Record<string, unknown> | null {
  if (article.status !== "PUBLISHED") return null;
  if (!hasText(article.title)) return null;

  const datePublished = toIsoDate(
    article.publishedAtIso ?? article.publishedAt,
  );
  if (!datePublished) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    mainEntityOfPage: canonicalUrl,
    datePublished,
    publisher: {
      "@type": "Organization",
      name: "JobEthiopia",
    },
    ...(hasText(article.excerpt) ? { description: article.excerpt } : {}),
    ...(hasText(article.category) ? { articleSection: article.category } : {}),
  };
}

/** Escape characters that could break out of an inline JSON-LD script. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
