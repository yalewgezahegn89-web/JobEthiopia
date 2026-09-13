/**
 * First-party monetization configuration (provider-neutral advertising).
 *
 * Monetization is fully OPT-IN: reserved slots render nothing until the
 * feature is enabled (`MONETIZATION_ENABLED=true`) AND a registered provider
 * selects the current request (`AD_PROVIDER`). Slots are also route-aware —
 * a placement only activates on the canonical (locale-free) paths it is
 * configured for, so ads can never appear on admin/employer/noindex pages.
 *
 * Privacy model mirrors the analytics layer: no third-party scripts, cookies,
 * or PII. Impressions/clicks flow through the first-party `analytics_events`
 * allowlist. This configuration is deliberately code-defined for Batch 10 so
 * the foundation lands without a schema change; a DB-backed routing layer can
 * replace or extend it later without touching callers.
 */
import type { Locale } from "@/lib/i18n/locale";

export type AdPlacementId = "jobs-list-top" | "job-detail-sidebar";

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

export const AD_PLACEMENTS: readonly AdPlacement[] = [
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

/**
 * Ads only render when monetization is enabled, the placement is known and
 * enabled, and the current pathname falls inside the placement's route.
 */
export function isPlacementEligible(
  placementId: string,
  pathname: string,
): boolean {
  if (!isMonetizationEnabled()) return false;
  const placement = getAdPlacement(placementId);
  if (!placement || !placement.enabled) return false;
  return matchesRoute(pathname, placement.route);
}

export type AdContent = {
  href: string;
  title: string;
  body?: string;
};

export type AdSlotContext = {
  placementId: AdPlacementId;
  pathname: string;
  locale: Locale;
};

/**
 * Contract for an ad-provider adapter. Providers are server-side only — the
 * CSP forbids third-party scripts and frames — and never receive request
 * bodies or candidate data.
 */
export interface AdProvider {
  id: string;
  render(context: AdSlotContext): AdContent | null;
}