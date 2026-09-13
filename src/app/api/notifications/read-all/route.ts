import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { markAllNotificationsRead } from "@/lib/notifications/dal";
import { logWarn } from "@/lib/observability/logger";

export async function POST(_request: Request) {
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

  try {
    const count = await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    logWarn("notification_mark_all_read_failed", {
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
