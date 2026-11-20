import { randomBytes } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_LOCALE_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/googleOAuth";

type Locale = "en" | "am" | "om";

function parseLocale(value: string | null): Locale {
  return value === "am" || value === "om" ? value : "en";
}

function loginUrl(locale: Locale): URL {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return new URL(`${prefix}/login?googleError=1`, getAppBaseUrl());
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_OAUTH_COOKIE_PATH,
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
  };
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(loginUrl(locale));
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const redirectUri = new URL(
    GOOGLE_OAUTH_CALLBACK_PATH,
    getAppBaseUrl(),
  ).toString();

  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();

  if (!codeVerifier || !codeChallenge) {
    return NextResponse.redirect(loginUrl(locale));
  }

  const authorizationUrl = new URL(
    client.generateAuthUrl({
      access_type: "online",
      scope: [...GOOGLE_OAUTH_SCOPES],
      state,
      prompt: "select_account",
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  );
  authorizationUrl.searchParams.set("nonce", nonce);

  const cookieStore = await cookies();
  const options = cookieOptions();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, options);
  cookieStore.set(GOOGLE_OAUTH_VERIFIER_COOKIE, codeVerifier, options);
  cookieStore.set(GOOGLE_OAUTH_NONCE_COOKIE, nonce, options);
  cookieStore.set(GOOGLE_OAUTH_LOCALE_COOKIE, locale, options);

  return NextResponse.redirect(authorizationUrl);
}
