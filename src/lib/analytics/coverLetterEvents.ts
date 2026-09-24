/**
 * Cover letter lifecycle analytics capture (privacy-preserving).
 *
 * Tracks only lifecycle actions — `cover_letter_created`, `cover_letter_updated`,
 * `cover_letter_previewed`, `cover_letter_downloaded`, `cover_letter_duplicated`,
 * `cover_letter_deleted` — with no metadata at all, so no letter content,
 * employer, position, or contact details can ever reach analytics. Same
 * best-effort, never-throws pattern as the CV capture (Batch 9).
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import { toLocale, type Locale } from "@/lib/i18n/locale";

export const COVER_LETTER_EVENTS = [
  "cover_letter_created",
  "cover_letter_updated",
  "cover_letter_previewed",
  "cover_letter_downloaded",
  "cover_letter_duplicated",
  "cover_letter_deleted",
] as const;

export type CoverLetterEventName = (typeof COVER_LETTER_EVENTS)[number];

export function isCoverLetterEvent(
  value: unknown,
): value is CoverLetterEventName {
  return (
    typeof value === "string" &&
    (COVER_LETTER_EVENTS as readonly string[]).includes(value)
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

export type CoverLetterEventInput = {
  event: CoverLetterEventName;
  locale?: Locale | string | null;
};

/**
 * Records a cover letter lifecycle event (best-effort, never throws). Only
 * allowlisted event names are stored; cover letter events never carry job ids
 * or metadata.
 */
export async function trackCoverLetterEvent(
  input: CoverLetterEventInput,
): Promise<void> {
  if (process.env.ANALYTICS_ENABLED === "false") return;

  const eventName: string = input.event;
  if (!isCoverLetterEvent(eventName)) {
    logWarn("analytics_event_rejected", {
      reason: "UNKNOWN_COVER_LETTER_EVENT",
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