import { ssrfFetch } from "@/lib/ssrf";
import { jsonFeedItemSchema } from "./feedSchema";
import {
  MAX_FEED_BYTES,
  MAX_FEED_ITEMS,
  loadFeedSource,
  errorMessage,
  type FeedParseContext,
} from "./feedSource";
import type { SourceAdapter, FetchResult } from "../adapter";
import type { RawJobInput } from "@/lib/ingestion/types";

export { MAX_FEED_BYTES, MAX_FEED_ITEMS };

/**
 * Parses a JSON array body into validated raw jobs. Shared by the dedicated
 * JSON adapter and the content-sniffing structured adapter so both keep
 * identical semantics.
 */
export function parseJsonFeedBody(
  text: string,
  context: FeedParseContext,
  maxItems: number = MAX_FEED_ITEMS,
):
  | { ok: true; jobs: RawJobInput[] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Invalid JSON response" };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Feed root must be a JSON array" };
  }

  const jobs: RawJobInput[] = [];
  for (const item of parsed.slice(0, maxItems)) {
    const result = jsonFeedItemSchema.safeParse(item);
    if (!result.success) {
      // Per-record isolation: one malformed listing must not fail the source.
      continue;
    }
    jobs.push({ ...result.data, sourceId: context.sourceId });
  }

  return { ok: true, jobs };
}

/**
 * Adapter for structured JSON feeds (sources with `sourceType` API or FEED).
 *
 * - Fetches the source's `baseUrl` with the SSRF-safe client (GET, bounded body).
 * - Requires the response to be a JSON array conforming to the feed schema.
 * - Isolates invalid records: a malformed item is skipped without failing the
 *   whole fetch; valid items map one-to-one to `RawJobInput`.
 */
export class JsonFeedAdapter implements SourceAdapter {
  constructor(private readonly maxItems: number = MAX_FEED_ITEMS) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    const loaded = await loadFeedSource(sourceId);
    if (!loaded.ok) return { success: false, error: loaded.error };

    const { source } = loaded;

    let response;
    try {
      response = await ssrfFetch(source.baseUrl!, {
        method: "GET",
        maxBytes: MAX_FEED_BYTES,
      });
    } catch (err: unknown) {
      return { success: false, error: errorMessage(err) };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const parsed = parseJsonFeedBody(
      response.text ?? "",
      {
        sourceId: source.id,
        sourceName: source.name,
        baseUrl: source.baseUrl!,
      },
      this.maxItems,
    );

    if (!parsed.ok) return { success: false, error: parsed.error };
    return { success: true, jobs: parsed.jobs };
  }
}
