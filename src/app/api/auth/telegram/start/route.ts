import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

const COOKIE_PATH = "/api/auth/telegram";
const STATE_COOKIE = "telegram_oauth_state";
const VERIFIER_COOKIE = "telegram_oauth_verifier";
const NONCE_COOKIE = "telegram_oauth_nonce";
const LOCALE_COOKIE = "telegram_oauth_locale";
const COOKIE_MAX_AGE = 10 * 60;

type Locale = "en" | "am" | "om";

function parseLocale(value: string | null): Locale {
  return value === "am" || value === "om" ? value : "en";
}

function loginUrl(locale: Locale): URL {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return new URL(`${prefix}/login?telegramError=1`, getAppBaseUrl());
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function GET(request: NextRequest) {
  const clientId = process.env.TELEGRAM_CLIENT_ID;
  const clientSecret = process.env.TELEGRAM_CLIENT_SECRET;
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));

  // Until BotFather credentials are configured, fail back to the localized
  // sign-in screen rather than sending users to a broken provider URL.
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(loginUrl(locale));
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = new URL("/api/auth/telegram/callback", getAppBaseUrl()).toString();

  const authorizationUrl = new URL("https://oauth.telegram.org/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  const cookieStore = await cookies();
  const options = cookieOptions();
  cookieStore.set(STATE_COOKIE, state, options);
  cookieStore.set(VERIFIER_COOKIE, verifier, options);
  cookieStore.set(NONCE_COOKIE, nonce, options);
  cookieStore.set(LOCALE_COOKIE, locale, options);

  return NextResponse.redirect(authorizationUrl);
}
