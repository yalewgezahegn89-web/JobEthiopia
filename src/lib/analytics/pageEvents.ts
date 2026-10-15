/**
 * Public page-view capture (Phase 15).
 *
 * Answers two product questions that no existing event can answer:
 * "which public pages attract users?" and "which career tools are viewed?".
 *
 * Privacy and bounds:
 * - only paths from an explicit route-pattern allowlist are stored, so raw
 *   URLs, query strings, slugs, and any private route can never be recorded;
 * - `path` is a route pattern (e.g. `/careers/[id]`), never a concrete id;
 * - no cookies, no scripts, no PII, no user identity column exists;
 * - metadata is allowlisted and bounded exactly like discovery events.
 *
 * Reliability: best-effort. Analytics is disabled, an unknown path, or a
 * storage failure all result in a silent, logged no-op — never a failed page
 * render (callers still wrap the call in try/catch).
 */
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema/analyticsEvents";
import { logWarn, logError } from "@/lib/observability/logger";
import type { Locale } from "@/lib/i18n/locale";
import { isAnalyticsEnabled, resolveAnalyticsLocale } from "./events";

export const PAGE_EVENTS = ["page_viewed"] as const;

export type PageEventName = (typeof PAGE_EVENTS)[number];

/** Allowlisted public/career-tool route patterns. */
export const PAGE_VIEW_PATHS = [
  "/",
  "/careers",
  "/careers/[id]",
  "/cv",
  "/cover-letter",
  "/interview-prep",
] as const;

export type PageViewPath = (typeof PAGE_VIEW_PATHS)[number];

const METADATA_KEYS: Record<PageEventName, readonly string[]> = {
  page_viewed: ["path"],
};

const MAX_STRING_LENGTH = 64;

export function isPageEvent(value: unknown): value is PageEventName {
  return (
    typeof value === "string" &&
    (PAGE_EVENTS as readonly string[]).includes(value)
  );
}

export function isPageViewPath(value: unknown): value is PageViewPath {
  return (
    typeof value === "string" &&
    (PAGE_VIEW_PATHS as readonly string[]).includes(value)
  );
}

/**
 * Maps a concrete pathname onto an allowlisted route pattern so detail pages
 * aggregate without storing ids or slugs.
 */
export function resolvePageViewPath(pathname: string): PageViewPath | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (isPageViewPath(normalized)) return normalized;
  if (normalized.startsWith("/careers/")) return "/careers/[id]";
  return null;
}

/**
 * Defense-in-depth: keeps only allowlisted metadata keys and coerces values
 * to safe primitives.
 */
export function sanitizePageMetadata(
  event: PageEventName,
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const allowed = METADATA_KEYS[event] ?? [];
  const output: Record<string, unknown> = {};
  if (metadata == null) return output;
  for (const key of allowed) {
    const value = metadata[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      output[key] = value.slice(0, MAX_STRING_LENGTH);
    }
  }
  return output;
}

export type PageViewInput = {
  pathname: string;
  locale?: Locale | string | null;
};

/**
 * Records a page view (best-effort, never throws).
 *
 * Silently skipped when analytics is disabled or the pathname is not on the
 * allowlist; storage failures are caught, logged, and swallowed.
 */
export async function trackPageView(input: PageViewInput): Promise<void> {
  if (!isAnalyticsEnabled()) return;

  const path = resolvePageViewPath(input.pathname);
  if (!path) {
    logWarn("analytics_event_rejected", {
      reason: "PATH_NOT_ALLOWLISTED",
      event: "page_viewed",
    });
    return;
  }

  const locale = await resolveAnalyticsLocale(input.locale);
  const metadata = sanitizePageMetadata("page_viewed", { path });

  try {
    await db.insert(analyticsEvents).values({
      event: "page_viewed",
      locale,
      metadata,
    });
  } catch (err) {
    logError("analytics_event_capture_failed", {
      event: "page_viewed",
      errorCode: "CAPTURE_FAILED",
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
  }
}
