import {
  classifyApplicantEligibility,
  type ApplicantEligibility,
} from "@/lib/jobs/applicantEligibility";
import type { RawJobInput } from "@/lib/ingestion/types";
import { resolveSafeHttpUrl, type FeedParseContext } from "./feedSource";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => textOf(item))
      .filter((item): item is string => item !== null);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (isRecord(value)) {
    return (
      textOf(value.name) ??
      textOf(value.value) ??
      textOf(value["@value"]) ??
      null
    );
  }
  return null;
}

function typeIncludesJobPosting(value: unknown): boolean {
  for (const type of asArray(value)) {
    if (typeof type !== "string") continue;
    const normalized = type.replace(/^.*[/#]/, "").toLowerCase();
    if (normalized === "jobposting") return true;
  }
  return false;
}

function collectJobPostings(
  value: unknown,
  out: JsonRecord[],
  depth = 0,
  seen: Set<object> = new Set(),
): void {
  if (depth > 24 || out.length >= 500) return;

  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, out, depth + 1, seen);
    return;
  }

  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (typeIncludesJobPosting(value["@type"])) {
    out.push(value);
    return;
  }

  for (const nested of Object.values(value)) {
    collectJobPostings(nested, out, depth + 1, seen);
  }
}

function postalAddressText(value: unknown): string | null {
  if (!isRecord(value)) return textOf(value);

  const parts = [
    textOf(value.addressLocality),
    textOf(value.addressRegion),
    textOf(value.addressCountry),
  ].filter((part): part is string => part !== null);

  if (parts.length > 0) {
    return Array.from(new Set(parts)).join(", ");
  }
  return textOf(value.name) ?? textOf(value.streetAddress);
}

function jobLocationText(value: unknown): string | null {
  const locations = asArray(value)
    .map((location) => {
      if (isRecord(location)) {
        return postalAddressText(location.address) ?? textOf(location.name);
      }
      return textOf(location);
    })
    .filter((part): part is string => part !== null);

  if (locations.length === 0) return null;
  return Array.from(new Set(locations)).join("; ");
}

function salaryText(value: unknown): string | null {
  if (!isRecord(value)) return textOf(value);

  const currency = textOf(value.currency) ?? "";
  const unit = textOf(value.unitText) ?? "";
  const amount = isRecord(value.value) ? value.value : value;

  const min = textOf(amount.minValue) ?? textOf(amount.value);
  const max = textOf(amount.maxValue);

  let range: string | null = null;
  if (min && max && min !== max) {
    range = `${min} - ${max}`;
  } else if (min ?? max) {
    range = min ?? max;
  }

  if (!range) return null;
  return [currency, range, unit].filter(Boolean).join(" ").trim();
}

function experienceText(value: unknown): string | null {
  if (!isRecord(value)) return textOf(value);

  const months = textOf(value.monthsOfExperience);
  if (months) return `${months} months`;
  return textOf(value.value) ?? null;
}

function educationText(value: unknown): string | null {
  if (!isRecord(value)) return textOf(value);
  return (
    textOf(value.credentialCategory) ??
    textOf(value.educationalCredentialAwarded) ??
    textOf(value.value)
  );
}

function isoDate(value: unknown): string | null {
  const text = textOf(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function applicantLocationText(value: unknown): string | null {
  const parts = asArray(value)
    .map((item) => textOf(item))
    .filter((item): item is string => item !== null);
  return parts.length > 0 ? parts.join("; ") : null;
}

function mapJobPosting(
  posting: JsonRecord,
  context: FeedParseContext,
): RawJobInput | null {
  const title = textOf(posting.title);
  const description = textOf(posting.description);
  if (!title || !description) return null;

  const organization = posting.hiringOrganization;
  const organizationName =
    (isRecord(organization) ? textOf(organization.name) : textOf(organization)) ??
    context.sourceName;

  const rawUrl = posting.url ?? posting.applicationUrl ?? null;
  const applicationUrl = rawUrl
    ? resolveSafeHttpUrl(rawUrl, context.baseUrl)
    : null;
  // Drop records whose only application URL is unsafe (javascript:, etc.).
  if (rawUrl !== null && rawUrl !== undefined && !applicationUrl) return null;

  const location = jobLocationText(posting.jobLocation);
  const remote =
    textOf(posting.jobLocationType)?.toUpperCase() === "TELECOMMUTE";
  const locationName = location ?? (remote ? "Remote" : null);

  const eligibilityTexts: Array<string | null> = [
    applicantLocationText(posting.applicantLocationRequirements),
    textOf(posting.eligibility),
    textOf(posting.applicantEligibility),
  ];
  const applicantEligibility: ApplicantEligibility =
    classifyApplicantEligibility(...eligibilityTexts);

  const identifier = posting.identifier;
  const externalId =
    textOf(identifier) ??
    (isRecord(identifier)
      ? textOf(identifier.value) ?? textOf(identifier.name)
      : null) ??
    (rawUrl ? String(rawUrl) : null);

  return {
    title,
    description,
    organizationName,
    sourceId: context.sourceId,
    locationName,
    categoryName:
      textOf(posting.occupationalCategory) ?? textOf(posting.industry),
    employmentType: textOf(posting.employmentType),
    salaryRaw: salaryText(posting.baseSalary),
    experienceRaw: experienceText(posting.experienceRequirements),
    responsibilities: textOf(posting.responsibilities),
    requirements:
      textOf(posting.qualifications) ?? textOf(posting.requirements),
    educationRequirements: educationText(posting.educationRequirements),
    benefits: textOf(posting.jobBenefits) ?? textOf(posting.benefits),
    postedAt: isoDate(posting.datePosted),
    deadline: isoDate(posting.validThrough),
    applicantEligibility,
    applicationUrl,
    sourceUrl: applicationUrl,
    externalId,
  };
}

const JSON_LD_PATTERN =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export type SchemaOrgParseResult =
  | { ok: true; jobs: RawJobInput[]; found: number }
  | { ok: false; error: string };

/**
 * Extracts and parses schema.org `JobPosting` records from a JSON document,
 * a JSON-LD array, or an HTML page containing `application/ld+json` blocks.
 *
 * Only objects carrying `@type: JobPosting` are imported; unrelated structured
 * data is ignored. Malformed blocks are skipped individually and unsafe
 * application URLs cause that single record to be dropped.
 */
export function parseSchemaOrgJobPostingBody(
  text: string,
  context: FeedParseContext,
  maxItems = 100,
): SchemaOrgParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty response" };

  const documents: unknown[] = [];

  if (trimmed.startsWith("<")) {
    let match: RegExpExecArray | null;
    const pattern = new RegExp(JSON_LD_PATTERN.source, "gi");
    while ((match = pattern.exec(trimmed)) !== null) {
      const block = match[1]?.trim();
      if (!block) continue;
      try {
        documents.push(JSON.parse(block));
      } catch {
        // A malformed JSON-LD block must not break the whole page.
      }
    }
    if (documents.length === 0) {
      return { ok: false, error: "No JSON-LD data found" };
    }
  } else {
    try {
      documents.push(JSON.parse(trimmed));
    } catch {
      return { ok: false, error: "Invalid JSON response" };
    }
  }

  const postings: JsonRecord[] = [];
  for (const document of documents) {
    collectJobPostings(document, postings);
  }

  const jobs: RawJobInput[] = [];
  for (const posting of postings.slice(0, maxItems)) {
    const job = mapJobPosting(posting, context);
    if (job) jobs.push(job);
  }

  return { ok: true, jobs, found: postings.length };
}

/** Returns true when the body contains a JSON-LD script block. */
export function looksLikeJsonLd(text: string): boolean {
  const pattern = new RegExp(JSON_LD_PATTERN.source, "i");
  return pattern.test(text.slice(0, 512 * 1024));
}
