/**
 * First-party matching/recommendations analytics capture (privacy-preserving).
 *
 * A dedicated allowlist so matching events never pollute discovery analytics
 * (mirrors the ad-events pattern). The only stored metadata is a result count
 * — never candidate content, skill names, scores, prompts, or provider
 * responses. There is no user linkage and no client-side collection. Capture
 * is best-effort and gated on analytics being enabled.
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import { toLocale, type Locale } from "@/lib/i18n/locale";

export const MATCH_EVENTS = ["match_recommendations_viewed"] as const;

export type MatchEventName = (typeof MATCH_EVENTS)[number];

const METADATA_KEYS: Record<MatchEventName, readonly string[]> = {
  match_recommendations_viewed: ["resultCount"],
};

export function isMatchEvent(value: unknown): value is MatchEventName {
  return (
    typeof value === "string" &&
    (MATCH_EVENTS as readonly string[]).includes(value)
  );
}

/**
 * Keeps only allowlisted keys, coerces numbers to finite bounded integers, and
 * drops everything else.
 */
export function sanitizeMatchMetadata(
  event: MatchEventName,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const allowed = METADATA_KEYS[event] ?? [];
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    if (metadata == null) continue;
    const value = metadata[key];
    if (value === undefined || value === null) continue;
    if (key === "resultCount") {
      if (typeof value === "number" && Number.isFinite(value)) {
        output[key] = Math.min(1000, Math.max(0, Math.floor(value)));
      }
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

export type MatchEventInput = {
  event: MatchEventName;
  locale?: Locale | string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records a matching event (best-effort, never throws). Skips when analytics
 * is disabled; rejects unknown events and empty metadata without disturbing
 * the caller, so recommendations can never be broken by capture.
 */
export async function trackMatchEvent(input: MatchEventInput): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === "false") return;

  const eventName: string = input.event;
  if (!isMatchEvent(eventName)) {
    logWarn("analytics_event_rejected", {
      reason: "UNKNOWN_MATCH_EVENT",
      event: eventName.slice(0, 64),
    });
    return;
  }

  const metadata = sanitizeMatchMetadata(eventName, input.metadata);
  if (Object.keys(metadata).length === 0) {
    logWarn("analytics_event_rejected", {
      reason: "EMPTY_MATCH_METADATA",
      event: eventName,
    });
    return;
  }

  const locale = await resolveLocale(input.locale);

  try {
    await db.insert(analyticsEvents).values({
      event: eventName,
      jobId: null,
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