import { JsonFeedAdapter } from "./jsonFeed";
import type { SourceAdapter } from "../adapter";

/**
 * Source types eligible for automated ingestion.
 *
 * Used both by the adapter registry and by the due-sweep query in
 * {@link runSourcesIngestion}, keeping the sweep bounded to the types that
 * actually have an adapter. Types not listed here (MANUAL, WEBSITE,
 * EMPLOYER, OTHER) must flow through moderation/manual pipelines and are
 * never polled by automated ingestion.
 */
export const SUPPORTED_ADAPTER_SOURCE_TYPES: ("API" | "FEED")[] = [
  "API",
  "FEED",
];

/**
 * Registry mapping a source's `sourceType` to its automated ingestion adapter.
 *
 * Only structured source types are eligible for automated ingestion. Sources
 * with a disallowed type (MANUAL, WEBSITE, EMPLOYER, OTHER) are intentionally
 * not adapted — their listings must flow through moderation/manual pipelines.
 */
export function getAdapterForSource(
  sourceType: string,
): SourceAdapter | null {
  if (
    (SUPPORTED_ADAPTER_SOURCE_TYPES as readonly string[]).includes(sourceType)
  ) {
    return new JsonFeedAdapter();
  }
  return null;
}

export type { SourceAdapter };