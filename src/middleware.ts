import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { buildRateLimitKey, checkRateLimit } from "@/lib/rateLimit";

/* ── Rate-limit configs ────────────────────────────────────────────────── */

const LOGIN = { limit: 5, windowMs: 15 * 60_000 } as const;
const INGESTION = { limit: 10, windowMs: 60_000 } as const;
const API_MUTATION = { limit: 30, windowMs: 60_000 } as const;
const MAINTENANCE = { limit: 3, windowMs: 5 * 60_000 } as const;

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
  const { pathname } = request.nextUrl;
  const method = request.method;

  /* ── Rate limiting ─────────────────────────────────────────────────── */

  // Login — only POST (Server Action submissions); GET navigation is open.
  if (pathname === "/login" && method === "POST") {
    const clientIp = resolveClientIp(request);
    const result = checkRateLimit(buildRateLimitKey("login", clientIp), LOGIN);
    if (!result.allowed) {
      return rateLimited(result.retryAfterSeconds!);
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
        return rateLimited(result.retryAfterSeconds!);
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
          return rateLimited(result.retryAfterSeconds!);
        }
      } else {
        const result = checkRateLimit(
          buildRateLimitKey("api", clientIp),
          API_MUTATION,
        );
        if (!result.allowed) {
          return rateLimited(result.retryAfterSeconds!);
        }
      }
    }
  }

  /* ── Admin cookie-presence check ──────────────────────────────────── */

  if (pathname.startsWith("/admin")) {
    const hasToken = Boolean(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );

    if (!hasToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/login"],
};
