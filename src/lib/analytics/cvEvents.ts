/**
 * CV lifecycle analytics capture (privacy-preserving).
 *
 * Tracks only lifecycle actions — `cv_created`, `cv_updated`, `cv_previewed`,
 * `cv_downloaded`, `cv_deleted` — with no metadata at all, so no CV content,
 * skills, employment history, education text, or contact details can ever
 * reach analytics. Mirror of the discovery capture pattern from Batch 8:
 * best-effort, never throws, event names allowlisted, locale restricted to
 * the supported site locales (en|am|om).
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import { toLocale, type Locale } from "@/lib/i18n/locale";

export const CV_EVENTS = [
  "cv_created",
  "cv_updated",
  "cv_previewed",
  "cv_downloaded",
  "cv_deleted",
] as const;

export type CvEventName = (typeof CV_EVENTS)[number];

export function isCvEvent(value: unknown): value is CvEventName {
  return (
    typeof value === "string" &&
    (CV_EVENTS as readonly string[]).includes(value)
  );
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

export type CvEventInput = {
  event: CvEventName;
  locale?: Locale | string | null;
};

/**
 * Records a CV lifecycle event (best-effort, never throws). Only allowlisted
 * event names are stored; cv events never carry job ids or metadata. Any
 * storage failure is caught, logged, and swallowed so analytics can never
 * break a CV operation.
 */
export async function trackCvEvent(input: CvEventInput): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === "false") return;

  const eventName: string = input.event;
  if (!isCvEvent(eventName)) {
    logWarn("analytics_event_rejected", {
      reason: "UNKNOWN_CV_EVENT",
      event: eventName.slice(0, 64),
    });
    return;
  }

  const locale = await resolveLocale(input.locale);

  try {
    await db.insert(analyticsEvents).values({
      event: eventName,
      jobId: null,
      locale,
      metadata: {},
    });
  } catch (err) {
    logError("analytics_event_capture_failed", {
      event: eventName,
      errorCode: "CAPTURE_FAILED",
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
  }
}