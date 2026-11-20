import { StructuredFeedAdapter, AirlineWebsiteAdapter } from "./structuredFeed";
import { FacebookPageAdapter } from "./facebookPage";
import { isAllowedAirlineHost } from "../providers/registry";
import type { SourceAdapter } from "../adapter";

/**
 * Source types eligible for automated ingestion through the structured feed
 * adapter. Kept to structured API/FEED sources; bare `WEBSITE` sources are
 * only adapted through {@link getAdapterForSourceRecord} when their host is an
 * approved airline provider.
 */
export const SUPPORTED_ADAPTER_SOURCE_TYPES: ("API" | "FEED")[] = [
  "API",
  "FEED",
];

/**
 * Source types considered by the due-sweep query. `WEBSITE` is included so
 * approved airline career pages can be polled, but
 * {@link getAdapterForSourceRecord} still rejects any non-allow-listed host.
 * `FACEBOOK` sources are only swept when `ENABLE_FACEBOOK_INGESTION` is on;
 * the scheduler filters them out at query time when the flag is disabled.
 */
export const SWEEP_SOURCE_TYPES: ("API" | "FEED" | "WEBSITE" | "FACEBOOK")[] = [
  ...SUPPORTED_ADAPTER_SOURCE_TYPES,
  "WEBSITE",
  "FACEBOOK",
];

interface SourceAdapterTarget {
  sourceType: string;
  baseUrl: string | null;
  facebookPageId?: string | null;
  facebookPageKind?: "OWNED_PAGE" | "EXTERNAL_PAGE" | null;
  facebookApprovalState?:
    | "NOT_REQUESTED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | null;
  facebookContentUseState?:
    | "NOT_RECORDED"
    | "PENDING"
    | "AUTHORIZED"
    | "DENIED"
    | null;
}

function hostOf(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Registry mapping a source's `sourceType` to its automated ingestion adapter.
 *
 * Only structured source types are eligible by type alone. Sources with a
 * disallowed type (MANUAL, WEBSITE, EMPLOYER, OTHER) are intentionally not
 * adapted here — use {@link getAdapterForSourceRecord} for the host-checked
 * airline website path.
 */
export function getAdapterForSource(
  sourceType: string,
): SourceAdapter | null {
  if (
    (SUPPORTED_ADAPTER_SOURCE_TYPES as readonly string[]).includes(sourceType)
  ) {
    return new StructuredFeedAdapter();
  }
  return null;
}

/**
 * Resolves an adapter for a concrete source record.
 *
 * API/FEED sources use the structured feed adapter. WEBSITE sources are only
 * adapted when their base URL host belongs to an airline provider with an
 * approved automated endpoint; every other website remains manual.
 */
export function getAdapterForSourceRecord(
  source: SourceAdapterTarget,
): SourceAdapter | null {
  const structured = getAdapterForSource(source.sourceType);
  if (structured) return structured;

  if (source.sourceType === "WEBSITE") {
    const host = hostOf(source.baseUrl);
    if (host && isAllowedAirlineHost(host)) {
      return new AirlineWebsiteAdapter();
    }
  }

  if (source.sourceType === "FACEBOOK") {
    return new FacebookPageAdapter();
  }

  return null;
}

export type { SourceAdapter };
