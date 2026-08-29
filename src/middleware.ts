import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Coarse protection for the admin area.
 *
 * This only checks for the presence of the session cookie so the middleware
 * stays lightweight and never touches the database. Authoritative session and
 * role verification happens server-side in the admin layout.
 */
export function middleware(request: NextRequest) {
  const hasToken = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};