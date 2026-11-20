/**
 * Deterministic Facebook Page post -> job extraction.
 *
 * Only information explicitly present in the post message is used. Missing
 * fields are left empty (never invented) and surfaced as review reasons so the
 * item can remain a draft until a moderator completes it.
 */
import type { RawJobInput } from "@/lib/ingestion/types";
import {
  classifyApplicantEligibility,
  type ApplicantEligibility,
} from "@/lib/jobs/applicantEligibility";

export interface FacebookPost {
  id: string;
  message?: string | null;
  createdTime?: string | null;
  permalinkUrl?: string | null;
  /** Raw Graph API field name, accepted as a convenience. */
  created_time?: string | null;
  /** Raw Graph API field name, accepted as a convenience. */
  permalink_url?: string | null;
}

export interface FacebookExtractContext {
  sourceId: string;
  pageId: string;
  pageName: string;
}

export type FacebookExtractionResult =
  | {
      kind: "JOB";
      job: RawJobInput;
      reviewReasons: string[];
    }
  | { kind: "NOT_A_JOB"; reason: string };

const JOB_SIGNAL =
  /(we(?:'re| are) hiring|now hiring|job (?:vacancy|opportunity|title|posting)|vacant (?:position|post)|position\s*[:\-]|vacancy\s*[:\-]|call for applications|recruiting|apply (?:now|via|at|through|online|here)|how to apply|send (?:your )?(?:cv|resume|application)|application deadline|closing date|qualified (?:candidates|applicants)|deadline\s*[:\-])/i;

const NOT_A_JOB_SIGNAL =
  /(webinar|workshop|training (?:session|program|course)|conference|announcement|giveaway|discount|promotion|product launch|follow us|subscribe|like our page)/i;

const GENERIC_HIRING_LINE =
  /^(?:we(?:'re| are) hiring|now hiring|vacancy|job vacancy|job opportunity|call for applications|recruiting)[\s!.:-]*$/i;

const LABEL_PATTERNS: Array<{
  key: string;
  pattern: RegExp;
  multiline?: boolean;
}> = [
  {
    key: "title",
    pattern:
      /^(?:job\s+title|position|role|vacancy|title|we(?:'re| are) hiring|now hiring)\s*[:\-]\s*(.+)$/i,
  },
  {
    key: "organization",
    pattern:
      /^(?:employer|company|organization|organisation|hiring organization)\s*[:\-]\s*(.+)$/i,
  },
  {
    key: "location",
    pattern:
      /^(?:location|duty station|work location|place of work|based in|job location)\s*[:\-]\s*(.+)$/i,
  },
  {
    key: "deadline",
    pattern:
      /^(?:deadline|application deadline|closing date|apply before|valid until|last date(?: to apply)?)\s*[:\-]\s*(.+)$/i,
  },
  {
    key: "requirements",
    pattern:
      /^(?:requirements?|required qualifications?|qualifications?|education(?:al)? requirements?)\s*[:\-]\s*(.+)$/i,
    multiline: true,
  },
  {
    key: "responsibilities",
    pattern:
      /^(?:responsibilities|duties|tasks|key duties)\s*[:\-]\s*(.+)$/i,
    multiline: true,
  },
  {
    key: "description",
    pattern: /^(?:description|job description|about the role)\s*[:\-]\s*(.+)$/i,
    multiline: true,
  },
  {
    key: "salary",
    pattern: /^(?:salary|compensation|pay)\s*[:\-]\s*(.+)$/i,
  },
  {
    key: "employmentType",
    pattern:
      /^(?:employment type|job type|contract type|work type)\s*[:\-]\s*(.+)$/i,
  },
];

interface LabeledSections {
  values: Map<string, string>;
  consumedLines: Set<number>;
}

function collectLabeledSections(message: string): LabeledSections {
  const lines = message.split(/\r?\n/);
  const values = new Map<string, string>();
  const consumedLines = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const { key, pattern, multiline } of LABEL_PATTERNS) {
      const match = line.match(pattern);
      if (!match) continue;

      const parts = [match[1].trim()];
      consumedLines.add(i);

      if (multiline) {
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (!next) break;
          if (LABEL_PATTERNS.some(({ pattern: p }) => p.test(next))) break;
          parts.push(next);
          consumedLines.add(j);
        }
      }

      if (!values.has(key)) {
        values.set(key, parts.join("\n").trim());
      }
      break;
    }
  }

  return { values, consumedLines };
}

function cleanLine(value: string): string {
  return value
    .replace(/^[\s>*\-•·◦]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[).,;:!?\]}]+$/, "");
}

function extractUrls(message: string): string[] {
  const matches = message.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return matches
    .map((raw) => trimTrailingPunctuation(raw))
    .filter((raw) => isSafeHttpUrl(raw));
}

function isFacebookPostUrl(url: string, permalink: string | null): boolean {
  if (permalink && url === permalink) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("facebook.com") || host === "fb.com") return true;
    if (host === "m.me" || host.endsWith("messenger.com")) return true;
    return false;
  } catch {
    return true;
  }
}

function parseFacebookDate(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const isoDate = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const date = new Date(
      `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T23:59:59.999Z`,
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dayFirst = value.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const monthNames =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i;
  const monthFirst = value.match(monthNames);
  if (monthFirst) {
    const date = new Date(
      Date.UTC(
        Number(monthFirst[3]),
        monthIndex(monthFirst[1]),
        Number(monthFirst[2]),
        23,
        59,
        59,
        999,
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dayMonthName =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})\b/i;
  const dayFirstNamed = value.match(dayMonthName);
  if (dayFirstNamed) {
    const date = new Date(
      Date.UTC(
        Number(dayFirstNamed[3]),
        monthIndex(dayFirstNamed[2]),
        Number(dayFirstNamed[1]),
        23,
        59,
        59,
        999,
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function monthIndex(name: string): number {
  return MONTH_NAMES.indexOf(name.toLowerCase());
}

function detectEmploymentType(message: string): string | null {
  const normalized = message.toLowerCase();
  if (/\b(full[\s-]?time)\b/.test(normalized)) return "FULL_TIME";
  if (/\b(part[\s-]?time)\b/.test(normalized)) return "PART_TIME";
  if (/\b(contract(?:or|ual)?|fixed[\s-]?term)\b/.test(normalized)) {
    return "CONTRACT";
  }
  if (/\b(intern(?:ship)?)\b/.test(normalized)) return "INTERNSHIP";
  if (/\b(temporary|temp)\b/.test(normalized)) return "TEMPORARY";
  if (/\b(volunteer)\b/.test(normalized)) return "VOLUNTEER";
  if (/\b(freelance)\b/.test(normalized)) return "FREELANCE";
  return null;
}

function buildDescription(input: {
  message: string;
  labeled: LabeledSections;
  title: string;
  requirements: string | null;
  responsibilities: string | null;
  pageName: string;
  permalink: string | null;
}): string {
  const {
    message,
    labeled,
    title,
    requirements,
    responsibilities,
    pageName,
    permalink,
  } = input;

  const labeledDescription = labeled.values.get("description");
  let body = labeledDescription ?? "";

  if (!body) {
    const remaining = message
      .split(/\r?\n/)
      .map((line, index) =>
        labeled.consumedLines.has(index) ? "" : cleanLine(line),
      )
      .filter((line) => line.length > 0)
      .filter((line) => line.toLowerCase() !== title.toLowerCase())
      .join("\n");
    body = remaining.split(/\n{2,}/)[0] ?? "";
  }

  body = body.trim().slice(0, 1500);
  if (!body) body = title;

  const sections: string[] = [body];
  if (responsibilities) sections.push(`Responsibilities:\n${responsibilities}`);
  if (requirements) sections.push(`Requirements:\n${requirements}`);

  const attribution = permalink
    ? `Source: ${pageName} on Facebook. Original post: ${permalink}`
    : `Source: ${pageName} on Facebook.`;
  sections.push(attribution);

  return sections.join("\n\n");
}

export function extractFacebookJobPost(
  post: FacebookPost,
  context: FacebookExtractContext,
): FacebookExtractionResult {
  const message = (post.message ?? "").trim();
  if (!message) {
    return { kind: "NOT_A_JOB", reason: "Post has no message text" };
  }

  if (!JOB_SIGNAL.test(message)) {
    return {
      kind: "NOT_A_JOB",
      reason: "Post does not contain a recognizable job-vacancy signal",
    };
  }

  const hasStrongVacancySignal =
    /(job (?:vacancy|opportunity|title|posting)|vacant (?:position|post)|position\s*[:\-]|vacancy\s*[:\-]|application deadline|closing date|how to apply|apply (?:now|via|at|through|online|here))/i.test(
      message,
    );
  if (!hasStrongVacancySignal && NOT_A_JOB_SIGNAL.test(message)) {
    return {
      kind: "NOT_A_JOB",
      reason: "Post looks like a non-vacancy announcement",
    };
  }

  const labeled = collectLabeledSections(message);

  const permalinkRaw =
    (post.permalinkUrl ?? post.permalink_url)?.trim() ?? null;
  const permalink =
    permalinkRaw && isSafeHttpUrl(permalinkRaw) ? permalinkRaw : null;

  const urls = extractUrls(message);
  const applicationUrl =
    urls.find((url) => !isFacebookPostUrl(url, permalink)) ?? null;

  const titleFromLabel = labeled.values.get("title");
  const titleFallback = message
    .split(/\r?\n/)
    .map(cleanLine)
    .find(
      (line) =>
        line.length >= 5 &&
        line.length <= 120 &&
        !GENERIC_HIRING_LINE.test(line) &&
        !/^https?:\/\//i.test(line),
    );
  const title = (titleFromLabel ?? titleFallback ?? "").trim();
  if (!title) {
    return { kind: "NOT_A_JOB", reason: "No job title could be determined" };
  }

  const organizationName =
    labeled.values.get("organization")?.trim() || context.pageName;

  const requirements = labeled.values.get("requirements")?.trim() || null;
  const responsibilities =
    labeled.values.get("responsibilities")?.trim() || null;

  const locationName =
    labeled.values.get("location")?.trim().slice(0, 200) || null;

  const deadlineRaw = labeled.values.get("deadline") ?? null;
  const deadline = parseFacebookDate(deadlineRaw);

  const postedAt = (() => {
    const raw = post.createdTime ?? post.created_time;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  })();

  const salaryRaw = labeled.values.get("salary")?.trim().slice(0, 200) || null;
  const employmentType =
    detectEmploymentType(labeled.values.get("employmentType") ?? "") ??
    detectEmploymentType(message);

  const applicantEligibility: ApplicantEligibility =
    classifyApplicantEligibility(message);

  const description = buildDescription({
    message,
    labeled,
    title,
    requirements,
    responsibilities,
    pageName: context.pageName,
    permalink,
  });

  const reviewReasons: string[] = [];
  if (!applicationUrl) {
    reviewReasons.push(
      "No safe application URL was found in the post; add one during review",
    );
  }
  if (!deadline) {
    reviewReasons.push(
      "No application deadline could be parsed from the post; add one during review",
    );
  }
  if (applicantEligibility === "NOT_STATED") {
    reviewReasons.push(
      "Applicant eligibility is not explicitly stated by the post",
    );
  }
  if (!locationName) {
    reviewReasons.push("No job location was found in the post");
  }
  reviewReasons.push("Category and profession must be assigned by a moderator");

  const job: RawJobInput = {
    title,
    description,
    organizationName,
    locationName,
    professionName: null,
    categoryName: null,
    employmentType,
    salaryRaw,
    experienceRaw: null,
    responsibilities,
    requirements,
    educationRequirements: null,
    benefits: null,
    postedAt,
    deadline,
    applicantEligibility,
    applicationUrl,
    sourceId: context.sourceId,
    externalId: `${context.pageId}:${post.id}`,
    sourceUrl: permalink,
  };

  return { kind: "JOB", job, reviewReasons };
}
