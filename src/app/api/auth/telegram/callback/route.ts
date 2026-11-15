import {
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { authenticateTelegramIdentity } from "@/lib/auth/telegram";
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session";

const COOKIE_PATH = "/api/auth/telegram";
const STATE_COOKIE = "telegram_oauth_state";
const VERIFIER_COOKIE = "telegram_oauth_verifier";
const NONCE_COOKIE = "telegram_oauth_nonce";
const LOCALE_COOKIE = "telegram_oauth_locale";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";

const DIAGNOSTIC_PREFIX = "[telegram-oauth-callback]";
const SAFE_OAUTH_ERROR_CODES = new Set<string>([
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "access_denied",
  "unauthorized_client",
  "server_error",
  "temporarily_unavailable",
]);
const SAFE_ERROR_CODES = new Set<string>([
  "TELEGRAM_KEYS_UNAVAILABLE",
  "TELEGRAM_KEYS_INVALID",
  "TELEGRAM_TOKEN_INVALID",
  "TELEGRAM_TOKEN_ALGORITHM_INVALID",
  "TELEGRAM_SIGNING_KEY_NOT_FOUND",
  "TELEGRAM_SIGNATURE_INVALID",
  "TELEGRAM_CLAIMS_INVALID",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EPIPE",
  "ABORT_ERR",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_ABORTED",
]);

type Locale = "en" | "am" | "om";
type DiagnosticStage =
  | "callback_received"
  | "provider_response"
  | "state_cookie_validation"
  | "token_exchange"
  | "token_response_validation"
  | "id_token_verification"
  | "account_authentication"
  | "session_creation";
type SafeDiagnosticDetails = Record<string, string | number | boolean>;
type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtClaims = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nbf?: unknown;
  nonce?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  preferred_username?: unknown;
};
type TelegramJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
type JwksResponse = { keys?: TelegramJwk[] };
type TokenResponse = { id_token?: string; error?: string };

let jwksCache: { keys: TelegramJwk[]; expiresAt: number } | null = null;

function parseLocale(value: string | undefined): Locale {
  return value === "am" || value === "om" ? value : "en";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function decodeJwtPart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

async function fetchSigningKeys(forceRefresh = false): Promise<TelegramJwk[]> {
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }
  const response = await fetch(JWKS_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("TELEGRAM_KEYS_UNAVAILABLE");
  const payload = (await response.json()) as JwksResponse;
  if (!Array.isArray(payload.keys)) throw new Error("TELEGRAM_KEYS_INVALID");
  jwksCache = { keys: payload.keys, expiresAt: Date.now() + 5 * 60_000 };
  return payload.keys;
}

async function verifyTelegramIdToken(
  token: string,
  expectedNonce: string,
  clientId: string,
): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("TELEGRAM_TOKEN_INVALID");
  }

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJwtPart<JwtHeader>(encodedHeader);
  const claims = decodeJwtPart<JwtClaims>(encodedClaims);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("TELEGRAM_TOKEN_ALGORITHM_INVALID");
  }

  let keys = await fetchSigningKeys();
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.use || key.use === "sig"));
  if (!jwk) {
    keys = await fetchSigningKeys(true);
    jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.use || key.use === "sig"));
  }
  if (!jwk) throw new Error("TELEGRAM_SIGNING_KEY_NOT_FOUND");

  const publicKey = createPublicKey({ key: jwk as unknown as import("crypto").JsonWebKey, format: "jwk" });
  const validSignature = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("TELEGRAM_SIGNATURE_INVALID");

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches =
    claims.aud === clientId ||
    (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  if (
    claims.iss !== TELEGRAM_ISSUER ||
    !audienceMatches ||
    typeof claims.sub !== "string" ||
    claims.sub.length === 0 ||
    claims.sub.length > 128 ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 60 ||
    (typeof claims.nbf === "number" && claims.nbf > now) ||
    typeof claims.nonce !== "string" ||
    !safeEqual(claims.nonce, expectedNonce)
  ) {
    throw new Error("TELEGRAM_CLAIMS_INVALID");
  }

  return claims;
}

function getDisplayName(claims: JwtClaims): string {
  const direct = typeof claims.name === "string" ? claims.name.trim() : "";
  const composed = [claims.given_name, claims.family_name]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join(" ")
    .trim();
  const username = typeof claims.preferred_username === "string"
    ? claims.preferred_username.trim()
    : "";
  const name = direct || composed || (username ? `@${username}` : "");
  return name.slice(0, 100) || "Telegram user";
}

function clearOAuthCookies(response: NextResponse): void {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NONCE_COOKIE, LOCALE_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: 0,
    });
  }
}

function localizedLoginPath(locale: Locale): string {
  return locale === "en" ? "/login?telegramError=1" : `/${locale}/login?telegramError=1`;
}

function logFailure(
  stage: DiagnosticStage,
  reason: string,
  details: SafeDiagnosticDetails = {},
): void {
  const serializedDetails = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const suffix = serializedDetails ? ` ${serializedDetails}` : "";
  console.error(
    `${DIAGNOSTIC_PREFIX} stage=${stage} event=failed reason=${reason}${suffix}`,
  );
}

function sanitizeHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : undefined;
}

function classifyError(error: unknown): {
  name: string;
  code?: string;
  status?: number;
} {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  const name =
    typeof candidate.name === "string" && /^[A-Za-z]{1,32}$/.test(candidate.name)
      ? candidate.name
      : "Error";
  const code =
    typeof candidate.code === "string" && SAFE_ERROR_CODES.has(candidate.code)
      ? candidate.code
      : undefined;
  const status =
    sanitizeHttpStatus(candidate.status) ??
    sanitizeHttpStatus(candidate.response?.status);

  return {
    name,
    ...(code === undefined ? {} : { code }),
    ...(status === undefined ? {} : { status }),
  };
}

function sanitizeOAuthErrorCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return SAFE_OAUTH_ERROR_CODES.has(trimmed) ? trimmed : undefined;
}

async function readOAuthErrorCode(response: Response): Promise<string | undefined> {
  const body = await response.text().catch(() => "");
  if (!body) return undefined;

  try {
    const payload = JSON.parse(body) as { error?: unknown };
    if (typeof payload.error === "string") {
      return sanitizeOAuthErrorCode(payload.error);
    }
  } catch {
    // Not JSON; fall through to form-encoded parsing.
  }

  return sanitizeOAuthErrorCode(new URLSearchParams(body).get("error"));
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  let stage: DiagnosticStage = "callback_received";
  const fail = (reason: string, details: SafeDiagnosticDetails = {}) => {
    logFailure(stage, reason, details);
    const response = NextResponse.redirect(
      new URL(localizedLoginPath(locale), getAppBaseUrl()),
    );
    clearOAuthCookies(response);
    return response;
  };

  try {
    stage = "provider_response";
    const params = request.nextUrl.searchParams;
    const oauthError = params.get("error");
    if (oauthError) {
      return fail("provider_error", {
        oauthError: sanitizeOAuthErrorCode(oauthError) ?? "none",
      });
    }

    stage = "state_cookie_validation";
    const code = params.get("code");
    const returnedState = params.get("state");
    const expectedState = cookieStore.get(STATE_COOKIE)?.value;
    const verifier = cookieStore.get(VERIFIER_COOKIE)?.value;
    const expectedNonce = cookieStore.get(NONCE_COOKIE)?.value;
    const clientId = process.env.TELEGRAM_CLIENT_ID;
    const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;

    if (
      !code ||
      !returnedState ||
      !expectedState ||
      !safeEqual(returnedState, expectedState) ||
      !verifier ||
      !expectedNonce ||
      !clientId ||
      !clientSecret
    ) {
      let reason = "state_validation_failed";
      if (!code) {
        reason = "missing_code";
      } else if (!returnedState || !expectedState) {
        reason = "missing_state";
      } else if (!safeEqual(returnedState, expectedState)) {
        reason = "state_mismatch";
      } else if (!verifier) {
        reason = "missing_pkce_verifier";
      } else if (!expectedNonce) {
        reason = "missing_nonce";
      } else if (!clientId || !clientSecret) {
        reason = "missing_client_config";
      }
      return fail(reason);
    }

    stage = "token_exchange";
    const redirectUri = new URL("/api/auth/telegram/callback", getAppBaseUrl()).toString();
    const tokenResponse = await fetch("https://oauth.telegram.org/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });
    if (!tokenResponse.ok) {
      const oauthErrorCode = await readOAuthErrorCode(tokenResponse);
      const httpStatus = sanitizeHttpStatus(tokenResponse.status);
      return fail("token_exchange_http_error", {
        ...(httpStatus === undefined ? {} : { httpStatus }),
        oauthError: oauthErrorCode ?? "none",
      });
    }

    stage = "token_response_validation";
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as TokenResponse | null;
    if (!tokenPayload?.id_token) return fail("missing_id_token");

    stage = "id_token_verification";
    const claims = await verifyTelegramIdToken(
      tokenPayload.id_token,
      expectedNonce,
      clientId,
    );
    const subject = claims.sub as string;

    stage = "account_authentication";
    const result = await authenticateTelegramIdentity({
      subject,
      name: getDisplayName(claims),
    });

    stage = "session_creation";
    const rawToken = await createSession(result.user.id);

    let destination = "/jobs";
    if (result.user.role === "SUPER_ADMIN" || result.user.role === "ADMIN" || result.user.role === "MODERATOR") {
      destination = "/admin";
    } else if (result.user.role === "ORGANIZATION_ADMIN") {
      destination = "/organization/applications";
    } else if (locale !== "en") {
      destination = `/${locale}/jobs`;
    }

    const response = NextResponse.redirect(new URL(destination, getAppBaseUrl()));
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    clearOAuthCookies(response);
    return response;
  } catch (error) {
    const { name, code, status } = classifyError(error);
    return fail("unexpected_error", {
      errorName: name,
      errorCode: code ?? "none",
      errorStatus: status ?? "none",
    });
  }
}
