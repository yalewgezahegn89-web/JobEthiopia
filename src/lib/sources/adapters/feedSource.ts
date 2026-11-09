import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";

/** Bounded response body cap for a single feed fetch (4 MiB). */
export const MAX_FEED_BYTES = 4 * 1024 * 1024;

/** Maximum number of feed records processed per fetch. */
export const MAX_FEED_ITEMS = 100;

export interface FeedSourceRecord {
  id: string;
  baseUrl: string | null;
  name: string;
}

export interface FeedParseContext {
  sourceId: string;
  sourceName: string;
  baseUrl: string;
}

export type FeedSourceResult =
  | { ok: true; source: FeedSourceRecord }
  | { ok: false; error: string };

export async function loadFeedSource(
  sourceId: string,
): Promise<FeedSourceResult> {
  const source = await db.query.sources.findFirst({
    where: eq(sources.id, sourceId),
    columns: { id: true, baseUrl: true, name: true },
  });

  if (!source) {
    return { ok: false, error: "Source not found" };
  }
  if (!source.baseUrl) {
    return { ok: false, error: "Source has no base URL configured" };
  }
  return {
    ok: true,
    source: { id: source.id, baseUrl: source.baseUrl, name: source.name },
  };
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Connection failed";
}

/**
 * Resolves a possibly-relative URL against a trusted absolute base and only
 * returns http(s) URLs. Anything else (javascript:, data:, file:, malformed)
 * yields null so callers can reject or drop it.
 */
export function resolveSafeHttpUrl(
  value: unknown,
  baseUrl: string,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Returns true when a value is present but not a safe http(s) URL. */
export function isUnsafeProvidedUrl(
  value: unknown,
  baseUrl: string,
): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return true;
  return value.trim().length > 0 && resolveSafeHttpUrl(value, baseUrl) === null;
}
