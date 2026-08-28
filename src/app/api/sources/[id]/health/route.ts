import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import {
  getSourceHealth,
  recordSuccessfulCheck,
  recordFailedCheck,
} from "@/lib/sources/health";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function checkApiKey(request: Request): Response | null {
  const configuredKey = process.env.INGESTION_API_KEY;

  if (!configuredKey) {
    return jsonError("Server configuration error", 500);
  }

  const providedKey = request.headers.get("x-api-key");

  if (!providedKey || providedKey !== configuredKey) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = sourceIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const health = await getSourceHealth(parsed.data.id);

    if (!health) {
      return jsonError("Source not found", 404);
    }

    return NextResponse.json({
      item: {
        sourceId: health.sourceId,
        lastSuccessfulCheck: health.lastSuccessfulCheck,
        lastAttemptedCheck: health.lastAttemptedCheck,
        hasError: health.lastError !== null,
        checkFrequencyMinutes: health.checkFrequencyMinutes,
        consecutiveFailures: health.consecutiveFailures,
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const parsed = sourceIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, parsed.data.id),
      columns: {
        id: true,
        baseUrl: true,
        sourceType: true,
        name: true,
      },
    });

    if (!source) {
      return jsonError("Source not found", 404);
    }

    if (!source.baseUrl) {
      return jsonError("Source has no base URL configured", 422);
    }

    let reachable = false;
    let errorMessage = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(source.baseUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);
      reachable = response.ok;
      if (!reachable) {
        errorMessage = `HTTP ${response.status}`;
      }
    } catch (err: unknown) {
      reachable = false;
      errorMessage =
        err instanceof Error ? err.message : "Connection failed";
    }

    const health = reachable
      ? await recordSuccessfulCheck(parsed.data.id)
      : await recordFailedCheck(parsed.data.id, errorMessage);

    if (!health) {
      return jsonError("Source not found", 404);
    }

    return NextResponse.json({
      item: {
        sourceId: health.sourceId,
        reachable,
        lastSuccessfulCheck: health.lastSuccessfulCheck,
        lastAttemptedCheck: health.lastAttemptedCheck,
        hasError: health.lastError !== null,
        checkFrequencyMinutes: health.checkFrequencyMinutes,
        consecutiveFailures: health.consecutiveFailures,
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
