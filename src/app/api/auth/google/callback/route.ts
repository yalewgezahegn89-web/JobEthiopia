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

const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;
const GOOGLE_TOTAL_RETRY_TIMEOUT_MS = 30_000;
const DIAGNOSTIC_PREFIX = "[google-oauth-callback]";

type Locale = "en" | "am" | "om";

type DiagnosticStage =
  | "validation"
  | "token_exchange"
  | "id_token_verification"
  | "account_lookup"
  | "account_creation"
  | "session_creation";

interface SafeErrorDetails {
  name: string;
  code?: string | number;
  status?: number;
}

function parseLocale(value: string | undefined): Locale {
  return value === "am" || value === "om" ? value : "en";
}

function classifyError(error: unknown): SafeErrorDetails {
  if (typeof error !== "object" || error === null) {
    return { name: typeof error };
  }

  const candidate = error as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  const code =
    typeof candidate.code === "string" || typeof candidate.code === "number"
      ? candidate.code
      : undefined;
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.response?.status === "number"
        ? candidate.response.status
        : undefined;

  return {
    name: typeof candidate.name === "string" ? candidate.name : "Error",
    ...(code === undefined ? {} : { code }),
    ...(status === undefined ? {} : { status }),
  };
}

function logStageStarted(stage: DiagnosticStage): number {
  const startedAt = Date.now();
  console.info(`${DIAGNOSTIC_PREFIX} stage=${stage} event=started`);
  return startedAt;
}

function logStageCompleted(
  stage: DiagnosticStage,
  startedAt: number,
  details: Record<string, string | number | boolean> = {},
): void {
  const serializedDetails = Object.entries(details)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const suffix = serializedDetails ? ` ${serializedDetails}` : "";
  console.info(
    `${DIAGNOSTIC_PREFIX} stage=${stage} event=completed elapsedMs=${Date.now() - startedAt}${suffix}`,
  );
}

function logStageFailed(
  stage: DiagnosticStage,
  startedAt: number,
  error: unknown,
): void {
  const { name, code, status } = classifyError(error);
  console.error(
    `${DIAGNOSTIC_PREFIX} stage=${stage} event=failed elapsedMs=${Date.now() - startedAt} errorName=${name} code=${code ?? "none"} status=${status ?? "none"}`,
  );
}

function logRedirect(
  outcome: "success" | "failure" | "conflict",
  path: string,
): void {
  console.info(
    `${DIAGNOSTIC_PREFIX} stage=redirect event=completed outcome=${outcome} destination=${path}`,
  );
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
    const redirectUrl = new URL(
      localizedLoginPath(locale, conflict),
      getAppBaseUrl(),
    );
    logRedirect(conflict ? "conflict" : "failure", redirectUrl.pathname);
    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response);
    return response;
  };

  let stage: DiagnosticStage = "validation";
  let stageStartedAt = logStageStarted(stage);

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

    logStageCompleted(stage, stageStartedAt, { outcome: "accepted" });

    const redirectUri = new URL(
      GOOGLE_OAUTH_CALLBACK_PATH,
      getAppBaseUrl(),
    ).toString();
    const client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
      transporterOptions: {
        timeout: GOOGLE_REQUEST_TIMEOUT_MS,
        retryConfig: { totalTimeout: GOOGLE_TOTAL_RETRY_TIMEOUT_MS },
      },
    });

    stage = "token_exchange";
    stageStartedAt = logStageStarted(stage);
    const { tokens } = await client.getToken({
      code,
      codeVerifier: verifier,
      redirect_uri: redirectUri,
    });
    logStageCompleted(stage, stageStartedAt, {
      hasIdToken: Boolean(tokens.id_token),
    });
    const idToken = tokens.id_token;
    if (!idToken) return fail();

    stage = "id_token_verification";
    stageStartedAt = logStageStarted(stage);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    logStageCompleted(stage, stageStartedAt, {
      hasPayload: Boolean(payload),
    });
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

    stage = "account_lookup";
    stageStartedAt = logStageStarted(stage);
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
      logStageCompleted(stage, stageStartedAt, {
        outcome: result.reason,
      });
      return fail(result.reason === "email_conflict");
    }
    logStageCompleted(stage, stageStartedAt, {
      outcome: result.created ? "created" : "existing",
    });
    if (result.created) {
      logStageCompleted("account_creation", stageStartedAt, {
        created: true,
      });
    }

    stage = "session_creation";
    stageStartedAt = logStageStarted(stage);
    const rawToken = await createSession(result.user.id);
    logStageCompleted(stage, stageStartedAt, { outcome: "created" });
    const destinationPath = destinationForRole(result.user.role, locale);
    const response = NextResponse.redirect(
      new URL(destinationPath, getAppBaseUrl()),
    );
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    clearOAuthCookies(response);
    logRedirect("success", destinationPath);
    return response;
  } catch (error) {
    logStageFailed(stage, stageStartedAt, error);
    return fail();
  }
}
