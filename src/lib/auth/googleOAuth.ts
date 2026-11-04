/**
 * Shared constants for the Google OAuth authorization-code flow.
 *
 * The temporary OAuth cookies are scoped to the Google auth routes and are
 * short-lived. They are HttpOnly and Secure in production so the state, nonce,
 * and PKCE verifier are never readable by client-side scripts.
 */
export const GOOGLE_OAUTH_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "google_oauth_verifier";
export const GOOGLE_OAUTH_NONCE_COOKIE = "google_oauth_nonce";
export const GOOGLE_OAUTH_LOCALE_COOKIE = "google_oauth_locale";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60;
export const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"] as const;
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/google/callback";
