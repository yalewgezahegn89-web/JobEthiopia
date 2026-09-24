/**
 * First-party monetization configuration (provider-neutral advertising).
 *
 * Monetization is fully OPT-IN: reserved slots render nothing until the
 * feature is enabled (`MONETIZATION_ENABLED=true`) AND a registered provider
 * selects the current request (`AD_PROVIDER`). Slots are also route-aware —
 * a placement only activates on the canonical (locale-free) paths it is
 * configured for, and every placement is additionally gated by the ad-free
 * route policy below, so ads can never appear on admin/employer/auth/account
 * pages even when a placement pattern is broadened later.
 *
 * Privacy model mirrors the analytics layer: no third-party scripts, cookies,
 * or PII. Impressions/clicks flow through the first-party `analytics_events`
 * allowlist. Any future script-based ad network must sit behind the provider
 * boundary and must not weaken the Content-Security-Policy.
 */
import type { Locale } from "@/lib/i18n/locale";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type AdPlacementId =
  | "home-banner"
  | "jobs-list-top"
  | "job-detail-sidebar"
  | "career-article-bottom";

export type AdPlacementFormat = "horizontal" | "rectangle";

export type AdPlacement = {
  id: AdPlacementId;
  /**
   * Canonical locale-free path pattern this placement is eligible on.
   * A trailing `/**` matches the base path and any nested segment.
   */
  route: string;
  /** Provider-agnostic size hint so future adapters reserve space safely. */
  format: AdPlacementFormat;
  enabled: boolean;
};

/**
 * Deterministic advertising inventory. Sparse and intentional: at most one
 * slot is mounted per page today, and the frequency policy is a hard cap.
 */
export const AD_PLACEMENTS: readonly AdPlacement[] = [
  {
    id: "home-banner",
    route: "/",
    format: "horizontal",
    enabled: true,
  },
  {
    id: "jobs-list-top",
    route: "/jobs",
    format: "horizontal",
    enabled: true,
  },
  {
    id: "job-detail-sidebar",
    route: "/jobs/**",
    format: "rectangle",
    enabled: true,
  },
  {
    id: "career-article-bottom",
    route: "/careers/**",
    format: "horizontal",
    enabled: true,
  },
] as const;

/**
 * Hard cap on the number of ad slots that may render per page. Kept small to
 * avoid saturation; placement decisions remain deterministic (no frequency
 * analytics, no personalization).
 */
export const MAX_AD_SLOTS_PER_PAGE = 2;

/**
 * Routes that must NEVER render advertising: authentication flows, candidate
 * account/security surfaces, employer workspace, admin, internal APIs, and
 * recovery/error-adjacent flows. Enforced as a guard inside
 * `isPlacementEligible` and exercised by dedicated policy tests.
 */
export const AD_FREE_ROUTE_PATTERNS: readonly string[] = [
  "/admin/**",
  "/api/**",
  "/applications/**",
  "/cover-letter/**",
  "/cv/**",
  "/employer/**",
  "/forgot-password/**",
  "/interview-prep/**",
  "/job-alerts/**",
  "/login/**",
  "/logout",
  "/notifications/**",
  "/organization/**",
  "/phone/**",
  "/profile/**",
  "/recommendations/**",
  "/register/**",
  "/reset-password/**",
  "/saved-jobs/**",
  "/settings/**",
  "/verify-email/**",
] as const;

/** The advertising/monetization feature is strictly opt-in. */
export function isMonetizationEnabled(): boolean {
  return process.env.MONETIZATION_ENABLED === "true";
}

export function getAdPlacement(id: string): AdPlacement | undefined {
  return AD_PLACEMENTS.find((placement) => placement.id === id);
}

export function isAdPlacementId(value: unknown): value is AdPlacementId {
  return (
    typeof value === "string" &&
    (AD_PLACEMENTS as readonly AdPlacement[]).some(
      (placement) => placement.id === value,
    )
  );
}

/**
 * Matches a canonical (locale-free) pathname against a placement route.
 * A trailing `/**` also matches the base path and any nested segment.
 */
export function matchesRoute(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return pathname === pattern;
}

/** True when the canonical pathname is covered by the ad-free policy. */
export function isAdFreeRoute(pathname: string): boolean {
  return AD_FREE_ROUTE_PATTERNS.some((pattern) => matchesRoute(pathname, pattern));
}

/**
 * Placements whose route matches a pathname AND that are not ad-free, minus
 * the global monetary enable toggle. Used by the frequency policy and tests.
 */
export function getEligiblePlacements(pathname: string): readonly AdPlacement[] {
  return AD_PLACEMENTS.filter(
    (placement) =>
      placement.enabled &&
      matchesRoute(pathname, placement.route) &&
      !isAdFreeRoute(pathname),
  );
}

/**
 * Ads only render when monetization is enabled, the pathname passes the
 * ad-free policy, the placement is known and enabled, and the current
 * pathname falls inside the placement's route.
 */
export function isPlacementEligible(
  placementId: string,
  pathname: string,
): boolean {
  if (!isMonetizationEnabled()) return false;
  if (isAdFreeRoute(pathname)) return false;
  const placement = getAdPlacement(placementId);
  if (!placement || !placement.enabled) return false;
  return matchesRoute(pathname, placement.route);
}

/**
 * Reserved minimum height per format, used to stabilize layout (CLS) before
 * a provider fills the slot. Mobile-first: horizontal units reserve 100px on
 * narrow screens (e.g. 320x100) and 90px on desktop (e.g. 728x90); rectangles
 * reserve 250px (e.g. 300x250). Heights are minimums, so text/house ads grow
 * naturally instead of being clipped.
 */
export function reserveClassForFormat(format: AdPlacementFormat): string {
  return format === "rectangle"
    ? "min-h-[250px]"
    : "min-h-[100px] sm:min-h-[90px]";
}

/** Localized copy key for first-party (house) ad content. */
export type AdCopyKey = keyof Dictionary["ads"]["house"];

/**
 * Provider-returned ad content. Providers may supply literal strings
 * (third-party/marketing copy that must not be translated by the app) or
 * i18n copy keys (first-party house ads). At least a title — literal or keyed
 * — is required for a slot to render.
 */
export type AdContent = {
  href: string;
  title?: string;
  body?: string;
  titleKey?: AdCopyKey;
  bodyKey?: AdCopyKey;
};

export type AdSlotContext = {
  placementId: AdPlacementId;
  pathname: string;
  locale: Locale;
};

/**
 * Contract for an ad-provider adapter. Providers are server-side only — the
 * CSP forbids third-party scripts and frames — and never receive request
 * bodies or candidate data. `tracking` is a stable, code-defined flag: when
 * true the provider participates in cross-site tracking and rendering is
 * consent-gated (see `lib/monetization/consent.ts`).
 */
export interface AdProvider {
  id: string;
  tracking: boolean;
  render(context: AdSlotContext): AdContent | null;
}