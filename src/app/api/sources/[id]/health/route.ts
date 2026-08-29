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
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { ssrfFetch, SsrfError } from "@/lib/ssrf";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

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
      const result = await ssrfFetch(source.baseUrl, { method: "HEAD" });
      reachable = result.ok;
      if (!reachable) {
        errorMessage = `HTTP ${result.status}`;
      }
    } catch (err: unknown) {
      reachable = false;
      if (err instanceof SsrfError) {
        errorMessage = err.message;
      } else {
        errorMessage =
          err instanceof Error ? err.message : "Connection failed";
      }
    }

    const health = reachable
      ? await recordSuccessfulCheck(parsed.data.id)
      : await recordFailedCheck(parsed.data.id, errorMessage);

    if (!health) {
      return jsonError("Source not found", 404);
    }

    await writeAuditLog({
      action: "SOURCE_HEALTH_CHECKED",
      targetType: "source",
      targetId: parsed.data.id,
      metadata: { source: "api_key", reachable },
    });

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
