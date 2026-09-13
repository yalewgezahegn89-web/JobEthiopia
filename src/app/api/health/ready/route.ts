import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/lib/observability/health";

export async function GET() {
  const ready = await checkDatabaseReadiness();
  return NextResponse.json(
    { status: ready ? "ok" : "error" },
    { status: ready ? 200 : 503 },
  );
}