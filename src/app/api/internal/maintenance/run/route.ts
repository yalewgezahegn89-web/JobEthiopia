import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runMaintenance } from "@/lib/maintenance/run";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkMaintenanceKey(request: Request): Response | null {
  const configuredKey = process.env.MAINTENANCE_API_KEY;

  if (!configuredKey) {
    return jsonError("Server configuration error", 500);
  }

  const providedKey = request.headers.get("x-maintenance-key") ?? "";

  if (!providedKey) {
    return jsonError("Unauthorized", 401);
  }

  const bufA = Buffer.from(providedKey, "utf8");
  const bufB = Buffer.from(configuredKey, "utf8");

  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

export async function POST(request: Request) {
  const authError = checkMaintenanceKey(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const result = await runMaintenance(now);
    return NextResponse.json(result);
  } catch {
    return jsonError("Internal server error", 500);
  }
}
