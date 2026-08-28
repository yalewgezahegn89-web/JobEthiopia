import { NextResponse } from "next/server";
import { getSourceHealth } from "@/lib/sources/health";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";

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
