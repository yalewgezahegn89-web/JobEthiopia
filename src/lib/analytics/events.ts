/**
 * First-party discovery analytics capture (privacy-preserving).
 *
 * Captures only server-allowlisted discovery events. Events are best-effort:
 * any failure inside capture is swallowed and logged so analytics can never
 * break a primary workflow or turn a page into an error.
 *
 * Privacy: no cookies, no client scripts, no PII. Event names and metadata
 * keys are allowlisted, metadata values are coerced to safe primitive types,
 * and `locale` is restricted to the supported site locales (en|am|om).
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import { toLocale, type Locale } from "@/lib/i18n/locale";

export const DISCOVERY_EVENTS = [
  "job_viewed",
  "job_search",
  "job_list_viewed",
] as const;

export type DiscoveryEventName = (typeof DISCOVERY_EVENTS)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const METADATA_KEYS: Record<DiscoveryEventName, readonly string[]> = {
  job_viewed: [],
  job_search: [
    "hasQuery",
    "hasCategory",
    "hasProfession",
    "hasLocation",
    "hasEmploymentType",
    "hasOrganization",
    "resultCount",
    "page",
  ],
  job_list_viewed: ["page"],
};

const MAX_STRING_LENGTH = 64;

export function isDiscoveryEvent(value: unknown): value is DiscoveryEventName {
  return (
    typeof value === "string" &&
    (DISCOVERY_EVENTS as readonly string[]).includes(value)
  );
}

export function isAnalyticsEnabled(): boolean {
  return process.env.ANALYTICS_ENABLED !== "false";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Classifies a public job list request as a search or a plain list view.
 * A search occurs when the request carries any query/filter dimension.
 */
export function classifyJobListEvent(
  params: {
    q?: string | null;
    categoryId?: string | null;
    professionId?: string | null;
    locationId?: string | null;
    employmentType?: string | null;
    organizationId?: string | null;
  },
): Extract<DiscoveryEventName, "job_search" | "job_list_viewed"> {
  const hasSearch =
    Boolean(params.q) ||
    Boolean(params.categoryId) ||
    Boolean(params.professionId) ||
    Boolean(params.locationId) ||
    Boolean(params.employmentType) ||
    Boolean(params.organizationId);
  return hasSearch ? "job_search" : "job_list_viewed";
}

/**
 * Builds the bounded, sanitized metadata payload for a job search event.
 * Only boolean presence flags and a result count are stored — never the raw
 * query string or the passed ids.
 */
export function buildJobSearchMetadata(params: {
  q?: string | null;
  categoryId?: string | null;
  professionId?: string | null;
  locationId?: string | null;
  employmentType?: string | null;
  organizationId?: string | null;
  resultCount?: number | null;
  page?: number | null;
}): Record<string, unknown> {
  return {
    hasQuery: Boolean(params.q),
    hasCategory: Boolean(params.categoryId),
    hasProfession: Boolean(params.professionId),
    hasLocation: Boolean(params.locationId),
    hasEmploymentType: Boolean(params.employmentType),
    hasOrganization: Boolean(params.organizationId),
    resultCount:
      typeof params.resultCount === "number" && Number.isFinite(params.resultCount)
        ? Math.max(0, Math.floor(params.resultCount))
        : 0,
    page:
      typeof params.page === "number" && Number.isFinite(params.page)
        ? Math.max(1, Math.floor(params.page))
        : 1,
  };
}

/**
 * Defense-in-depth: keeps only allowlisted keys and coerces every value to a
 * safe primitive, discarding anything unrecognized or non-finite.
 */
export function sanitizeMetadata(
  event: DiscoveryEventName,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const allowed = METADATA_KEYS[event] ?? [];
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    if (metadata == null) continue;
    const value = metadata[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      output[key] = value;
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) output[key] = value;
    } else if (typeof value === "string") {
      output[key] = value.slice(0, MAX_STRING_LENGTH);
    }
  }
  return output;
}

async function resolveLocale(locale?: unknown): Promise<Locale> {
  if (locale !== undefined && locale !== null) {
    return toLocale(locale);
  }
  try {
    const { getCurrentLocale } = await import("@/lib/i18n/server");
    return await getCurrentLocale();
  } catch {
    return "en";
  }
}

export type DiscoveryEventInput = {
  event: DiscoveryEventName;
  jobId?: string | null;
  locale?: Locale | string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records a discovery event (best-effort, never throws).
 *
 * Skips silently when analytics is disabled, the event is not on the
 * allowlist, or the job id (for job_viewed) is not a well-formed uuid. Any
 * storage failure is caught, logged, and swallowed.
 */
export async function trackDiscoveryEvent(
  input: DiscoveryEventInput,
): Promise<void> {
  if (!isAnalyticsEnabled()) return;

  const eventName: string = input.event;
  if (!isDiscoveryEvent(eventName)) {
    logWarn("analytics_event_rejected", {
      reason: "UNKNOWN_EVENT",
      event: eventName.slice(0, 64),
    });
    return;
  }

  const jobId = eventName === "job_viewed" && isUuid(input.jobId)
    ? input.jobId
    : null;

  const locale = await resolveLocale(input.locale);
  const metadata = sanitizeMetadata(eventName, input.metadata);

  try {
    await db.insert(analyticsEvents).values({
      event: eventName,
      jobId,
      locale,
      metadata,
    });
  } catch (err) {
    logError("analytics_event_capture_failed", {
      event: eventName,
      errorCode: "CAPTURE_FAILED",
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
  }
}