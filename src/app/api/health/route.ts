import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { NextResponse } from "next/server";
import { checkDatabaseReadinessDetailed } from "@/lib/observability/health";

async function __wrapped_GET() {
  const probe = await checkDatabaseReadinessDetailed();
  return NextResponse.json(
    {
      status: probe.ready ? "ok" : "error",
      databaseCheckDurationMs: probe.durationMs,
    },
    { status: probe.ready ? 200 : 503 },
  );
}
export const GET = withRouteMetrics("/api/health", "GET", __wrapped_GET);
