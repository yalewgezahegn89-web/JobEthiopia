/**
 * Facebook Page ingestion configuration.
 *
 * Credentials are read from the server environment only and are never stored
 * in the database, returned by an API, or rendered in the admin UI. A missing
 * configuration degrades gracefully: the adapter reports a clear error and the
 * rest of the application keeps working.
 */

export const FACEBOOK_DEFAULT_GRAPH_API_VERSION = "v23.0";
export const FACEBOOK_DEFAULT_GRAPH_API_BASE_URL =
  "https://graph.facebook.com";
export const FACEBOOK_GRAPH_API_ORIGIN = "https://graph.facebook.com";

const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;

/**
 * Token-bearing Graph requests may only target the official Graph origin over
 * HTTPS. Overrides must match the exact scheme, hostname and port; anything
 * else (plaintext HTTP, alternate ports, userinfo, other hosts) is rejected.
 */
export function isTrustedGraphBaseUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port !== "" && parsed.port !== "443") return false;
  if (parsed.search || parsed.hash) return false;
  if (parsed.pathname !== "/" && parsed.pathname !== "") return false;
  return parsed.origin === FACEBOOK_GRAPH_API_ORIGIN;
}

export interface FacebookGraphConfig {
  apiBaseUrl: string;
  apiVersion: string;
}

export type FacebookGraphConfigResult =
  | { ok: true; config: FacebookGraphConfig }
  | { ok: false; reason: string };

/** The dedicated Facebook ingestion flag. Disabled unless exactly "true". */
export function isFacebookIngestionEnabled(): boolean {
  return process.env.ENABLE_FACEBOOK_INGESTION?.trim() === "true";
}

function resolveGraphApiVersion(): string {
  const raw = process.env.FACEBOOK_GRAPH_API_VERSION?.trim();
  if (raw && GRAPH_VERSION_PATTERN.test(raw)) return raw;
  return FACEBOOK_DEFAULT_GRAPH_API_VERSION;
}

function resolveGraphApiBaseUrl(): string {
  const raw = process.env.FACEBOOK_GRAPH_API_BASE_URL?.trim();
  if (!raw) return FACEBOOK_DEFAULT_GRAPH_API_BASE_URL;
  // Fall back to the trusted official origin rather than ever sending a
  // bearer token to a misconfigured host, port or plaintext endpoint.
  if (!isTrustedGraphBaseUrl(raw)) return FACEBOOK_DEFAULT_GRAPH_API_BASE_URL;
  return new URL(raw).origin;
}

export function getFacebookGraphConfig(): FacebookGraphConfig {
  return {
    apiBaseUrl: resolveGraphApiBaseUrl(),
    apiVersion: resolveGraphApiVersion(),
  };
}

export type FacebookTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: string };

/**
 * Owned Page access token. Requires a Page access token minted for the
 * JobEthiopia Page. Permissions: `pages_show_list`,
 * `pages_read_engagement`, `pages_read_user_content`.
 */
export function getOwnedPageAccessToken(): FacebookTokenResult {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      reason: "FACEBOOK_PAGE_ACCESS_TOKEN is not configured",
    };
  }
  return { ok: true, accessToken: token };
}

/**
 * External Page content is read with an app access token after Page Public
 * Content Access approval. An explicit `FACEBOOK_APP_ACCESS_TOKEN` wins;
 * otherwise it is derived from `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.
 */
export function getExternalPageAccessToken(): FacebookTokenResult {
  const explicit = process.env.FACEBOOK_APP_ACCESS_TOKEN?.trim();
  if (explicit) return { ok: true, accessToken: explicit };

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return {
      ok: false,
      reason:
        "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are not configured (or set FACEBOOK_APP_ACCESS_TOKEN)",
    };
  }
  return { ok: true, accessToken: `${appId}|${appSecret}` };
}

/**
 * Removes credential material from an arbitrary string before it can reach a
 * log, error response, audit row, or admin view.
 */
export function redactFacebookSecrets(value: string): string {
  return value
    .replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .slice(0, 300);
}
