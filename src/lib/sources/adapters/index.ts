import { JsonFeedAdapter } from "./jsonFeed";
import type { SourceAdapter } from "../adapter";

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
  if (sourceType === "API" || sourceType === "FEED") {
    return new JsonFeedAdapter();
  }
  return null;
}

export type { SourceAdapter };