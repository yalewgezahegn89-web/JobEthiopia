import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildRateLimitKey, checkRateLimit } from "@/lib/rateLimit";
import {
  buildCspHeader,
  generateCspNonce,
  CSP_HEADER_NAME,
  CSP_REPORT_ONLY_HEADER_NAME,
} from "@/lib/csp";
import { logWarn } from "@/lib/observability/logger";
import {
  generateRequestId,
  REQUEST_ID_HEADER,
  applyRequestIdToHeaders,
} from "@/lib/observability/requestId";

/* ── CSP (Batch 72) ────────────────────────────────────────────────────── */

/**
 * Development reports the policy instead of enforcing it so tooling
 * regressions cannot take the app down; production enforces strictly.
 */
function cspResponseHeaderName(): string {
  return process.env.NODE_ENV === "production"
    ? CSP_HEADER_NAME
    : CSP_REPORT_ONLY_HEADER_NAME;
}

/**
 * Appends the CSP header to a response. The guard tolerates tests that stub
 * NextResponse with plain objects; real responses always expose a Headers.
 */
function applyCsp(
  response: NextResponse,
  headerName: string,
  value: string,
): NextResponse {
  const responseHeaders = (response as { headers?: Headers }).headers;
  if (responseHeaders && typeof responseHeaders.set === "function") {
    responseHeaders.set(headerName, value);
  }
  return response;
}

/**
 * Echoes the server-generated request correlation ID on the response. Uses
 * the same guarded pattern as applyCsp so tests that stub NextResponse with
 * plain objects remain unaffected.
 */
function applyRequestId(response: NextResponse, requestId: string): NextResponse {
  applyRequestIdToHeaders(
    (response as { headers?: Headers }).headers,
    requestId,
  );
  return response;
}

/* ── Rate-limit configs ────────────────────────────────────────────────── */

const LOGIN = { limit: 5, windowMs: 15 * 60_000 } as const;
const INGESTION = { limit: 10, windowMs: 60_000 } as const;
const API_MUTATION = { limit: 30, windowMs: 60_000 } as const;
const MAINTENANCE = { limit: 3, windowMs: 5 * 60_000 } as const;
const APPLICATIONS = { limit: 10, windowMs: 60_000 } as const;

/* ── Client-IP resolution ───────────────────────────────────────────────── */

/**
 * Shared fallback identity. This is intentionally a SHARED bucket: without an
 * observable connection IP or a configured trusted header, every client maps
 * to the same bucket rather than pretending 127.0.0.1 is a real client.
 */
const FALLBACK_CLIENT_IP = "127.0.0.1";

/**
 * Extracts a single client IP from a trusted header value.
 *
 * The header is only consulted when `TRUSTED_CLIENT_IP_HEADER` explicitly
 * names it. It is expected to be sanitized/overwritten by a trusted reverse
 * proxy, so the leftmost comma-separated value is the canonical client IP.
 * Malformed values (empty, list-chained garbage, non-IP characters, or
 * over-length) return `null` so the caller can fall back safely.
 */
function clientIpFromTrustedHeader(rawHeader: string): string | null {
  const first = rawHeader.split(",")[0]?.trim();
  if (!first) return null;
  if (first.length > 45) return null;
  if (/[^0-9a-fA-F.:%[\]]/.test(first)) return null;
  return first;
}

/**
 * Resolves the trusted client identity for rate limiting.
 *
 * Priority 1 — `request.ip` (socket-derived): NOT available in this runtime.
 * Next 16.3.3's NextRequest type does not declare it and the request adapter
 * does not populate it, so the raw connection IP cannot be observed from
 * middleware here.
 *
 * Priority 2 — `TRUSTED_CLIENT_IP_HEADER`, an operator-configured single
 * header name. This is OPT-IN: raw `x-forwarded-for` is never trusted by
 * default. It is honored only when it is the configured header AND the
 * deployment's reverse proxy sanitizes/overwrites that header.
 *
 * Priority 3 — no trusted identity available → `FALLBACK_CLIENT_IP` shared
 * bucket.
 */
function resolveClientIp(request: NextRequest): string {
  const trustedHeaderName = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (trustedHeaderName) {
    const value = request.headers.get(trustedHeaderName.toLowerCase());
    if (value) {
      const clientIp = clientIpFromTrustedHeader(value);
      if (clientIp) return clientIp;
    }
  }
  return FALLBACK_CLIENT_IP;
}

/* ── 429 response ──────────────────────────────────────────────────────── */

function rateLimited(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/* ── Middleware ─────────────────────────────────────────────────────────── */

export function middleware(request: NextRequest) {
  const cspHeaderName = cspResponseHeaderName();
  const cspValue = buildCspHeader(generateCspNonce());
  const { pathname } = request.nextUrl;
  const method = request.method;

  /* ── Request correlation (Batch 76) ────────────────────────────────── */
  // Always generate a fresh server-side ID; never trust an inbound header.
  const requestId = generateRequestId();
  const startedAt = performance.now();

  const logRejected = (status: number, route: string, bucket: string): void => {
    logWarn("rate_limit_rejected", {
      requestId,
      route,
      method,
      status,
      bucket,
      durationMs: Math.round(performance.now() - startedAt),
    });
  };

  /* ── Rate limiting ─────────────────────────────────────────────────── */

  // Login — only POST (Server Action submissions); GET navigation is open.
  if (pathname === "/login" && method === "POST") {
    const clientIp = resolveClientIp(request);
    const result = checkRateLimit(buildRateLimitKey("login", clientIp), LOGIN);
    if (!result.allowed) {
      logRejected(429, pathname, "login");
      return applyRequestId(
        applyCsp(
          rateLimited(result.retryAfterSeconds!),
          cspHeaderName,
          cspValue,
        ),
        requestId,
      );
    }
  }

  // /api/* routes
  if (pathname.startsWith("/api/")) {
    const clientIp = resolveClientIp(request);

    // Internal maintenance — rate-limited POST endpoint
    if (
      pathname === "/api/internal/maintenance/run" &&
      method === "POST"
    ) {
      const result = checkRateLimit(
        buildRateLimitKey("maintenance", clientIp),
        MAINTENANCE,
      );
      if (!result.allowed) {
        logRejected(429, pathname, "maintenance");
        return applyRequestId(
          applyCsp(
            rateLimited(result.retryAfterSeconds!),
            cspHeaderName,
            cspValue,
          ),
          requestId,
        );
      }
    }

      // Application submission/withdrawal/status — tighten per-candidate limits
      if (
        (pathname === "/api/applications" ||
          /^\/api\/applications\/[0-9a-f-]+$/i.test(pathname) ||
          /^\/api\/applications\/[0-9a-f-]+\/status$/i.test(pathname)) &&
        (method === "POST" || method === "PATCH")
      ) {
        const result = checkRateLimit(
          buildRateLimitKey("applications", clientIp),
          APPLICATIONS,
        );
        if (!result.allowed) {
          logRejected(429, pathname, "applications");
          return applyRequestId(
            applyCsp(
              rateLimited(result.retryAfterSeconds!),
              cspHeaderName,
              cspValue,
            ),
            requestId,
          );
        }
      }

      // Mutations — POST, PUT, PATCH, DELETE (GET is always open)
      if (method !== "GET" && method !== "HEAD") {
        // Job ingestion has its own tighter limit
        if (pathname === "/api/jobs/ingest" && method === "POST") {
        const result = checkRateLimit(
          buildRateLimitKey("ingest", clientIp),
          INGESTION,
        );
        if (!result.allowed) {
          logRejected(429, pathname, "ingest");
          return applyRequestId(
            applyCsp(
              rateLimited(result.retryAfterSeconds!),
              cspHeaderName,
              cspValue,
            ),
            requestId,
          );
        }
      } else {
        const result = checkRateLimit(
          buildRateLimitKey("api", clientIp),
          API_MUTATION,
        );
        if (!result.allowed) {
          logRejected(429, pathname, "api");
          return applyRequestId(
            applyCsp(
              rateLimited(result.retryAfterSeconds!),
              cspHeaderName,
              cspValue,
            ),
            requestId,
          );
        }
      }
    }
  }

  /* ── Cookie-presence check (admin + organization) ────────────────────── */

  if (pathname.startsWith("/admin") || pathname.startsWith("/organization")) {
    const hasToken = Boolean(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );

    if (!hasToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return applyRequestId(
        applyCsp(
          NextResponse.redirect(loginUrl),
          cspHeaderName,
          cspValue,
        ),
        requestId,
      );
    }
  }

  /* ── Pass-through with CSP nonce ──────────────────────────────────── */

  // Clone the request headers so the downstream render can read the nonce
  // from the CSP header (Next 16.3.3 resolves the nonce at render time) and
  // so route handlers can read the correlation ID.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(cspHeaderName, cspValue);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return applyRequestId(applyCsp(response, cspHeaderName, cspValue), requestId);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/login",
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
