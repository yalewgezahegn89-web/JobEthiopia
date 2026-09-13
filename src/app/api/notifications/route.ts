import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { listNotifications } from "@/lib/notifications/dal";
import { logWarn } from "@/lib/observability/logger";

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");

    const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;
    const limit = limitParam
      ? Math.min(50, Math.max(1, Number(limitParam) || 20))
      : 20;

    const result = await listNotifications(user.id, { page, limit });
    return NextResponse.json(result);
  } catch (err) {
    logWarn("notification_list_failed", {
      requestId: request.headers.get("x-request-id") ?? undefined,
      reason: err instanceof Error ? err.message.slice(0, 200) : "UNKNOWN",
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
