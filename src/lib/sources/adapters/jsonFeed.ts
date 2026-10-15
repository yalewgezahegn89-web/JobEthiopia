import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { ssrfFetch } from "@/lib/ssrf";
import { jsonFeedItemSchema } from "./feedSchema";
import type { SourceAdapter, FetchResult } from "../adapter";
import type { RawJobInput } from "@/lib/ingestion/types";

/** Bounded response body cap for a single feed fetch (4 MiB). */
export const MAX_FEED_BYTES = 4 * 1024 * 1024;

/** Maximum number of feed records processed per fetch. */
export const MAX_FEED_ITEMS = 100;

/**
 * Adapter for structured JSON feeds (sources with `sourceType` API or FEED).
 *
 * - Fetches the source's `baseUrl` with the SSRF-safe client (GET, bounded body).
 * - Requires the response to be a JSON array conforming to {@link jsonFeedItemSchema}.
 * - Isolates invalid records: a malformed item is skipped without failing the
 *   whole fetch; valid items map one-to-one to `RawJobInput`.
 */
export class JsonFeedAdapter implements SourceAdapter {
  constructor(private readonly maxItems: number = MAX_FEED_ITEMS) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
      columns: { id: true, baseUrl: true, name: true },
    });

    if (!source) {
      return { success: false, error: "Source not found" };
    }

    if (!source.baseUrl) {
      return { success: false, error: "Source has no base URL configured" };
    }

    let response;
    try {
      response = await ssrfFetch(source.baseUrl, {
        method: "GET",
        maxBytes: MAX_FEED_BYTES,
      });
    } catch (err: unknown) {
      return { success: false, error: errorMessage(err) };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text ?? "");
    } catch {
      return { success: false, error: "Invalid JSON response" };
    }

    if (!Array.isArray(parsed)) {
      return { success: false, error: "Feed root must be a JSON array" };
    }

    const jobs: RawJobInput[] = [];
    for (const item of parsed.slice(0, this.maxItems)) {
      const result = jsonFeedItemSchema.safeParse(item);
      if (!result.success) {
        // Per-record isolation: one malformed listing must not fail the source.
        continue;
      }
      jobs.push({ ...result.data, sourceId });
    }

    return { success: true, jobs };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Connection failed";
}