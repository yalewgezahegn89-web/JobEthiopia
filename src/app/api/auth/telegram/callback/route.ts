import {
  createPublicKey,
  randomBytes,
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

type Locale = "en" | "am" | "om";
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

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
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

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const fail = () => {
    const response = NextResponse.redirect(
      new URL(localizedLoginPath(locale), getAppBaseUrl()),
    );
    clearOAuthCookies(response);
    return response;
  };

  try {
    const params = request.nextUrl.searchParams;
    const oauthError = params.get("error");
    if (oauthError) return fail();

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
      return fail();
    }

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
    if (!tokenResponse.ok) return fail();

    const tokenPayload = (await tokenResponse.json().catch(() => null)) as TokenResponse | null;
    if (!tokenPayload?.id_token) return fail();

    const claims = await verifyTelegramIdToken(
      tokenPayload.id_token,
      expectedNonce,
      clientId,
    );
    const subject = claims.sub as string;
    const result = await authenticateTelegramIdentity({
      subject,
      name: getDisplayName(claims),
    });
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
  } catch {
    return fail();
  }
}
