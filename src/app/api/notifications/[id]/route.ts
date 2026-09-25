import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { markNotificationRead, deleteNotification } from "@/lib/notifications/dal";
import { logWarn } from "@/lib/observability/logger";

async function __wrapped_PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifySession(rawToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const updated = await markNotificationRead(id, user.id);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logWarn("notification_mark_read_failed", {
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function __wrapped_DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifySession(rawToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const deleted = await deleteNotification(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logWarn("notification_delete_failed", {
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
export const PATCH = withRouteMetrics("/api/notifications/[id]", "PATCH", __wrapped_PATCH);
export const DELETE = withRouteMetrics("/api/notifications/[id]", "DELETE", __wrapped_DELETE);
