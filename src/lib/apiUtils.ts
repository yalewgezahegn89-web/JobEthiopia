/**
 * Shared API-route utilities (Batch 58).
 *
 * Small, focused helpers used across the mutation route handlers to
 * enforce CSRF protection, body-size limits, and LIKE-pattern safety.
 */
import { NextResponse } from "next/server";

/* ── LIKE-pattern escaping ──────────────────────────────────────────────── */

/**
 * Escapes the three LIKE-special characters (`%`, `_`, `\`) so that user
 * input is treated as a literal substring in PostgreSQL ILIKE / LIKE
 * expressions.  The backslash is escaped first to avoid double-escaping.
 *
 * Usage with Drizzle:
 *   ilike(column, `%${escapeLikePattern(userInput)}%`)
 */
export function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

/* ── Body-size guard ────────────────────────────────────────────────────── */

/** Default maximum request body size: 1 MiB. */
export const DEFAULT_MAX_BODY_BYTES = 1 * 1024 * 1024;

/** Maximum for batch ingestion payloads: 4 MiB. */
export const INGESTION_MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Pre-parse body-size guard.  Reads the `Content-Length` header and returns
 * a 413 response when the declared size exceeds `maxBytes`.  Returns null
 * when the request may proceed.
 *
 * This avoids parsing an oversized body into memory.  If the header is
 * absent the check is skipped (Next.js applies its own default limit).
 */
export function checkBodySize(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10);
    if (Number.isFinite(size) && size > maxBytes) {
      return NextResponse.json(
        { error: "Payload Too Large" },
        { status: 413 },
      );
    }
  }
  return null;
}
