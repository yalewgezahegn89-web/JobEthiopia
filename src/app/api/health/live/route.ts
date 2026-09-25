import { withRouteMetrics } from "@/lib/observability/routeMetrics";
import { NextResponse } from "next/server";

async function __wrapped_GET() {
  return NextResponse.json({ status: "ok" });
}
export const GET = withRouteMetrics("/api/health/live", "GET", __wrapped_GET);
