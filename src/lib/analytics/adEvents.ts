/**
 * First-party ad impression/click capture (privacy-preserving).
 *
 * Dedicated allowlist so monetization events never pollute discovery
 * analytics. Ad events only ever carry a `placementId` (a code-defined
 * constant) — no URLs, scroll data, referrers, or PII. Capture is best-effort
 * and never throws, and is gated on BOTH analytics and monetization being
 * enabled so an ad toggle can never create event noise on its own.
 *
 * Impressions are recorded server-side when a slot actually renders an ad;
 * click tracking is reserved for provider callbacks. The allowlist keeps the
 * plumbing ready without faking clicks from the client.
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import { toLocale, type Locale } from "@/lib/i18n/locale";
import {
  isAdPlacementId,
  isMonetizationEnabled,
} from "@/lib/monetization/config";

export const AD_EVENTS = ["ad_impression", "ad_click"] as const;

export type AdEventName = (typeof AD_EVENTS)[number];

const METADATA_KEYS: Record<AdEventName, readonly string[]> = {
  ad_impression: ["placementId"],
  ad_click: ["placementId"],
};

const MAX_STRING_LENGTH = 64;

export function isAdEvent(value: unknown): value is AdEventName {
  return (
    typeof value === "string" &&
    (AD_EVENTS as readonly string[]).includes(value)
  );
}

/**
 * Keeps only the allowlisted `placementId` key, and only when it is a known
 * code-defined placement id — everything else is discarded.
 */
export function sanitizeAdMetadata(
  event: AdEventName,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const allowed = METADATA_KEYS[event] ?? [];
  const output: Record<string, unknown> = {};
  for (const key of allowed) {
    if (metadata == null) continue;
    const value = metadata[key];
    if (typeof value === "string" && isAdPlacementId(value)) {
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

export type AdEventInput = {
  event: AdEventName;
  placementId: string;
  locale?: Locale | string | null;
};

/**
 * Records an ad event (best-effort, never throws). Silently skips when
 * analytics or monetization is disabled; rejects unknown events, unknown
 * placement ids, and storage failures without disturbing the caller.
 */
export async function trackAdEvent(input: AdEventInput): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === "false") return;
  if (!isMonetizationEnabled()) return;

  const eventName: string = input.event;
  if (!isAdEvent(eventName)) {
    logWarn("analytics_event_rejected", {
      reason: "UNKNOWN_AD_EVENT",
      event: eventName.slice(0, 64),
    });
    return;
  }

  const metadata = sanitizeAdMetadata(eventName, {
    placementId: input.placementId,
  });
  if (Object.keys(metadata).length === 0) {
    logWarn("analytics_event_rejected", {
      reason: "INVALID_AD_PLACEMENT",
      placementId: input.placementId.slice(0, 64),
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