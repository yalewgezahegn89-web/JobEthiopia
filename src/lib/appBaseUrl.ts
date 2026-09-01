/**
 * Shared production-safe application base-URL resolver (B99).
 *
 * This is the single source of truth for resolving the public HTTPS origin
 * from APP_BASE_URL. It is dependency-free (no `next/headers`) so it can be
 * imported by metadata routes (sitemap/robots), the root layout, server pages,
 * and the public data-fetch helpers without pulling server-only modules into
 * client bundles.
 *
 * Policy (matches the CSRF helper it centralises):
 *   - A non-blank APP_BASE_URL is returned verbatim.
 *   - In production, a missing/blank APP_BASE_URL throws (fail fast) so the app
 *     can never silently emit `http://localhost:3000` canonical/public URLs.
 *   - Outside production (local development / tests), it falls back to
 *     `http://localhost:3000`.
 */
export function getAppBaseUrl(): string {
  const base = process.env.APP_BASE_URL?.trim();
  if (base && base.length > 0) return base;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL is required in production");
  }
  return "http://localhost:3000";
}