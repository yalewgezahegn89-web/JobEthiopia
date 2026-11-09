import { ssrfFetch } from "@/lib/ssrf";
import {
  MAX_FEED_BYTES,
  MAX_FEED_ITEMS,
  loadFeedSource,
  errorMessage,
  type FeedParseContext,
  type FeedSourceRecord,
} from "./feedSource";
import { parseJsonFeedBody } from "./jsonFeed";
import { looksLikeXmlFeed, parseXmlFeedBody } from "./xmlFeed";
import {
  looksLikeJsonLd,
  parseSchemaOrgJobPostingBody,
} from "./schemaOrgJobPosting";
import type { SourceAdapter, FetchResult } from "../adapter";
import type { RawJobInput } from "@/lib/ingestion/types";

export type FeedFormat = "JSON_FEED" | "XML_FEED" | "JSON_LD";

export type StructuredFeedParseResult =
  | { ok: true; jobs: RawJobInput[]; format: FeedFormat }
  | { ok: false; error: string };

/**
 * Detects and parses a structured feed body with a single fetch.
 *
 * Supported shapes, in sniffing order:
 * - JSON array -> documented JobEthiopia JSON feed.
 * - JSON object -> schema.org `JobPosting` (single object, array or `@graph`).
 * - XML document -> RSS 2.0 / RSS 1.0 (RDF) / Atom.
 * - HTML document with `application/ld+json` -> schema.org `JobPosting`.
 *
 * The content type header is intentionally not trusted; detection is based on
 * the bounded response body so mislabelled feeds still work and nothing is
 * fetched twice.
 */
export function parseStructuredFeedBody(
  text: string,
  context: FeedParseContext,
  maxItems: number = MAX_FEED_ITEMS,
): StructuredFeedParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty response" };

  if (trimmed.startsWith("[")) {
    const parsed = parseJsonFeedBody(trimmed, context, maxItems);
    if (!parsed.ok) return parsed;
    return { ok: true, jobs: parsed.jobs, format: "JSON_FEED" };
  }

  if (trimmed.startsWith("{")) {
    const parsed = parseSchemaOrgJobPostingBody(trimmed, context, maxItems);
    if (!parsed.ok) return parsed;
    return { ok: true, jobs: parsed.jobs, format: "JSON_LD" };
  }

  if (trimmed.startsWith("<")) {
    if (looksLikeXmlFeed(trimmed)) {
      const parsed = parseXmlFeedBody(trimmed, context, maxItems);
      if (!parsed.ok) return parsed;
      return { ok: true, jobs: parsed.jobs, format: "XML_FEED" };
    }
    if (looksLikeJsonLd(trimmed)) {
      const parsed = parseSchemaOrgJobPostingBody(trimmed, context, maxItems);
      if (!parsed.ok) return parsed;
      return { ok: true, jobs: parsed.jobs, format: "JSON_LD" };
    }
    return { ok: false, error: "Unsupported structured feed format" };
  }

  return { ok: false, error: "Unsupported feed content type" };
}

async function fetchStructured(
  source: FeedSourceRecord,
  maxItems: number,
): Promise<FetchResult> {
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

  const parsed = parseStructuredFeedBody(
    response.text ?? "",
    {
      sourceId: source.id,
      sourceName: source.name,
      baseUrl: source.baseUrl!,
    },
    maxItems,
  );

  if (!parsed.ok) return { success: false, error: parsed.error };
  return { success: true, jobs: parsed.jobs };
}

/**
 * Adapter for `API` and `FEED` sources. Performs exactly one SSRF-safe fetch
 * and dispatches to the matching parser based on the response body.
 */
export class StructuredFeedAdapter implements SourceAdapter {
  constructor(private readonly maxItems: number = MAX_FEED_ITEMS) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    const loaded = await loadFeedSource(sourceId);
    if (!loaded.ok) return { success: false, error: loaded.error };
    return fetchStructured(loaded.source, this.maxItems);
  }
}

/**
 * Adapter for `WEBSITE` sources that are explicit, allow-listed airline
 * career pages. The registry only points this adapter at official hosts, so
 * the fetch inherits the same SSRF-safe, single-fetch behaviour and reads
 * schema.org `JobPosting` data from the page.
 */
export class AirlineWebsiteAdapter implements SourceAdapter {
  constructor(private readonly maxItems: number = MAX_FEED_ITEMS) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    const loaded = await loadFeedSource(sourceId);
    if (!loaded.ok) return { success: false, error: loaded.error };

    const { source } = loaded;
    let host: string;
    try {
      host = new URL(source.baseUrl!).hostname.toLowerCase();
    } catch {
      return { success: false, error: "Source has an invalid base URL" };
    }

    const { isAllowedAirlineHost } = await import("../providers/registry");
    if (!isAllowedAirlineHost(host)) {
      return {
        success: false,
        error: "Source host is not an approved airline career page",
      };
    }

    return fetchStructured(source, this.maxItems);
  }
}
