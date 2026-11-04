import { timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  authenticateGoogleIdentity,
  isValidGoogleEmail,
} from "@/lib/auth/google";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_COOKIE_PATH,
  GOOGLE_OAUTH_LOCALE_COOKIE,
  GOOGLE_OAUTH_NONCE_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
} from "@/lib/auth/googleOAuth";
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth/session";

const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

type Locale = "en" | "am" | "om";

function parseLocale(value: string | undefined): Locale {
  return value === "am" || value === "om" ? value : "en";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clearOAuthCookies(response: NextResponse): void {
  for (const name of [
    GOOGLE_OAUTH_STATE_COOKIE,
    GOOGLE_OAUTH_VERIFIER_COOKIE,
    GOOGLE_OAUTH_NONCE_COOKIE,
    GOOGLE_OAUTH_LOCALE_COOKIE,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: GOOGLE_OAUTH_COOKIE_PATH,
      maxAge: 0,
    });
  }
}

function localizedLoginPath(
  locale: Locale,
  conflict = false,
): string {
  const query = conflict ? "googleConflict=1" : "googleError=1";
  return locale === "en" ? `/login?${query}` : `/${locale}/login?${query}`;
}

function destinationForRole(role: string, locale: Locale): string {
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "MODERATOR") {
    return "/admin";
  }
  if (role === "ORGANIZATION_ADMIN") {
    return "/organization/applications";
  }
  return locale === "en" ? "/jobs" : `/${locale}/jobs`;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const locale = parseLocale(
    cookieStore.get(GOOGLE_OAUTH_LOCALE_COOKIE)?.value,
  );
  const fail = (conflict = false) => {
    const response = NextResponse.redirect(
      new URL(localizedLoginPath(locale, conflict), getAppBaseUrl()),
    );
    clearOAuthCookies(response);
    return response;
  };

  try {
    const params = request.nextUrl.searchParams;
    if (params.get("error")) return fail();

    const code = params.get("code");
    const returnedState = params.get("state");
    const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    const verifier = cookieStore.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value;
    const expectedNonce =
      cookieStore.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value;
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

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

    const redirectUri = new URL(
      GOOGLE_OAUTH_CALLBACK_PATH,
      getAppBaseUrl(),
    ).toString();
    const client = new OAuth2Client({ clientId, clientSecret, redirectUri });

    const { tokens } = await client.getToken({
      code,
      codeVerifier: verifier,
      redirect_uri: redirectUri,
    });
    const idToken = tokens.id_token;
    if (!idToken) return fail();

    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) return fail();

    const now = Math.floor(Date.now() / 1000);
    const audience = payload.aud;
    const audienceMatches =
      audience === clientId ||
      (Array.isArray(audience) && audience.includes(clientId));
    const nonce = payload.nonce;

    if (
      !GOOGLE_ISSUERS.has(payload.iss ?? "") ||
      !audienceMatches ||
      typeof payload.exp !== "number" ||
      payload.exp <= now ||
      typeof payload.iat !== "number" ||
      payload.iat > now + 60 ||
      typeof nonce !== "string" ||
      !safeEqual(nonce, expectedNonce) ||
      typeof payload.sub !== "string" ||
      payload.sub.trim().length === 0 ||
      payload.sub.length > 255 ||
      typeof payload.email !== "string" ||
      !isValidGoogleEmail(payload.email) ||
      payload.email_verified !== true
    ) {
      return fail();
    }

    const result = await authenticateGoogleIdentity({
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: typeof payload.name === "string" ? payload.name : null,
      givenName: typeof payload.given_name === "string" ? payload.given_name : null,
      familyName: typeof payload.family_name === "string" ? payload.family_name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    });
    if (!result.ok) {
      return fail(result.reason === "email_conflict");
    }

    const rawToken = await createSession(result.user.id);
    const response = NextResponse.redirect(
      new URL(
        destinationForRole(result.user.role, locale),
        getAppBaseUrl(),
      ),
    );
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
