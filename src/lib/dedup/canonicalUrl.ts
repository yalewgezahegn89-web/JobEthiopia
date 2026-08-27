/**
 * Canonicalizes a source URL for deterministic duplicate comparison.
 *
 * - Trims whitespace
 * - Parses via the standard URL API
 * - Lowercases scheme and hostname
 * - Removes default ports (:80 for http, :443 for https)
 * - Removes trailing slash from pathname (except when pathname is exactly "/")
 * - Sorts query parameters alphabetically by key
 * - Strips URL fragments
 *
 * Returns null if the input is null/undefined/empty or cannot be parsed as a URL.
 */
export function canonicalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }

  // Lowercase scheme
  parsed.protocol = parsed.protocol.toLowerCase();

  // Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();

  // Remove default ports
  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  // Remove trailing slash from pathname (unless pathname is exactly "/")
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Sort query parameters deterministically
  if (parsed.search) {
    const params = new URLSearchParams(parsed.search);
    const sorted = new URLSearchParams();
    const keys = Array.from(params.keys()).sort();
    for (const key of keys) {
      const values = params.getAll(key);
      for (const value of values) {
        sorted.append(key, value);
      }
    }
    parsed.search = sorted.toString();
  }

  // Remove fragment (hash)
  parsed.hash = "";

  return parsed.toString();
}
