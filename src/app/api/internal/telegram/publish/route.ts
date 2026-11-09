import { NextResponse } from "next/server";
import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { checkInternalRouteKey } from "@/lib/auth/internalKey";
import { writeAuditLog } from "@/lib/auth/audit";
import { reportError } from "@/lib/observability/errors";
import {
  processTelegramOutbox,
  TELEGRAM_OUTBOX_BATCH_SIZE,
} from "@/lib/telegram/outbox";

const ROUTE = "/api/internal/telegram/publish";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function __wrapped_POST(request: Request) {
  const authResult = await checkInternalRouteKey(request, {
    route: ROUTE,
    keyEnvVar: "INTERNAL_TELEGRAM_API_KEY",
  });
  if (!authResult.ok) {
    return jsonError(authResult.message, authResult.status);
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  let limit = TELEGRAM_OUTBOX_BATCH_SIZE;
  if (rawLimit) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return jsonError("Invalid limit", 400);
    }
    limit = Math.min(parsed, TELEGRAM_OUTBOX_BATCH_SIZE);
  }

  try {
    const result = await processTelegramOutbox(limit);

    await writeAuditLog({
      action: "TELEGRAM_OUTBOX_RUN",
      targetType: "telegram",
      targetId: "outbox",
      metadata: {
        configured: result.configured,
        reason: result.reason,
        claimed: result.claimed,
        sent: result.sent,
        retried: result.retried,
        failed: result.failed,
        skipped: result.skipped,
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    reportError("telegram_outbox_run_failed", error, {
      route: ROUTE,
      method: "POST",
      status: 500,
    });
    return jsonError("Internal server error", 500);
  }
}

export const POST = withRouteMetrics(ROUTE, "POST", __wrapped_POST);
