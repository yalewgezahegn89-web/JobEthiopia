import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { checkRateLimit } from "@/lib/rateLimit";

/* ── Rate-limit configs ────────────────────────────────────────────────── */

const LOGIN = { limit: 5, windowMs: 15 * 60_000 } as const;
const INGESTION = { limit: 10, windowMs: 60_000 } as const;
const API_MUTATION = { limit: 30, windowMs: 60_000 } as const;
const MAINTENANCE = { limit: 3, windowMs: 5 * 60_000 } as const;

/* ── IP resolution ─────────────────────────────────────────────────────── */

function resolveIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "127.0.0.1";
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
    const ip = resolveIp(request);
    const result = checkRateLimit(`login:${ip}`, LOGIN);
    if (!result.allowed) {
      return rateLimited(result.retryAfterSeconds!);
    }
  }

  // /api/* routes
  if (pathname.startsWith("/api/")) {
    const ip = resolveIp(request);

    // Internal maintenance — rate-limited despite being GET
    if (
      pathname === "/api/internal/maintenance/run" &&
      method === "GET"
    ) {
      const result = checkRateLimit(`maintenance:${ip}`, MAINTENANCE);
      if (!result.allowed) {
        return rateLimited(result.retryAfterSeconds!);
      }
    }

    // Mutations — POST, PUT, PATCH, DELETE (GET is always open)
    if (method !== "GET" && method !== "HEAD") {
      // Job ingestion has its own tighter limit
      if (pathname === "/api/jobs/ingest" && method === "POST") {
        const result = checkRateLimit(`ingest:${ip}`, INGESTION);
        if (!result.allowed) {
          return rateLimited(result.retryAfterSeconds!);
        }
      } else {
        const result = checkRateLimit(`api:${ip}`, API_MUTATION);
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
