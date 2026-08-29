import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "./session";
import { STAFF_ROLES, isStaffRole } from "./roles";
import type { AuthUser } from "./roles";

export type RoleGuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; status: 401 | 403 };

/**
 * Resolves the current authenticated user from the session cookie.
 *
 * Safe to call anywhere (server component, route handler, server action).
 * Returns null when there is no valid session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) return null;
  return verifySession(rawToken);
}

/**
 * Resolves the current user's id or null. Used for audit-log actor attribution.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? user.id : null;
}

/**
 * requireRole(request, "ADMIN") — future route-handler form.
 * Returns a prepared error response on 401/403, or the authenticated user on
 * success so handlers can proceed without repeating authorization logic.
 */
export async function requireRole(
  request: Request,
  required: (typeof STAFF_ROLES)[number],
): Promise<{ response: NextResponse } | { user: AuthUser }> {
  const user = await resolveRequestUser(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.role !== required) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * requireAnyRole(request, [...roles]) — future route-handler form.
 * Same contract as requireRole but accepts any of the listed roles.
 */
export async function requireAnyRole(
  request: Request,
  allowed: readonly (typeof STAFF_ROLES)[number][],
): Promise<{ response: NextResponse } | { user: AuthUser }> {
  const user = await resolveRequestUser(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!allowed.includes(user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * Server-component guard for the admin UI (e.g., admin layout).
 * Distinguishes 401 (unauthenticated) from 403 (authenticated, wrong role).
 */
export async function requireStaffAdmin(): Promise<RoleGuardResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401 };
  if (!isStaffRole(user.role)) return { ok: false, status: 403 };
  return { ok: true, user };
}

/**
 * Reads the session token out of a Request's Cookie header directly, avoiding
 * reliance on the next/headers request context. Used by the guards above.
 */
async function resolveRequestUser(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = parseCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;
  return verifySession(token);
}

export function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key === name) {
      return trimmed.slice(eqIndex + 1);
    }
  }
  return null;
}

export { isStaffRole };
