import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { ingestJobs } from "@/lib/ingestion/batch";
import { batchIngestionRequestSchema } from "@/lib/validations/batchIngestion";
import type { RawJobInput } from "@/lib/ingestion/types";
import { checkApiKey } from "@/lib/auth/apiKey";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { writeAuditLog } from "@/lib/auth/audit";
import { checkBodySize, INGESTION_MAX_BODY_BYTES } from "@/lib/apiUtils";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  const bodySizeError = checkBodySize(request, INGESTION_MAX_BODY_BYTES);
  if (bodySizeError) return bodySizeError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = batchIngestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { sourceId, jobs } = parsed.data;

  try {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, sourceId),
      columns: { id: true, isActive: true },
    });

    if (!source || !source.isActive) {
      return jsonError("Source not found or inactive", 404);
    }

    const result = await ingestJobs({
      sourceId,
      jobs: jobs as RawJobInput[],
    });

    await writeAuditLog({
      action: "JOB_INGESTED",
      targetType: "source",
      targetId: sourceId,
      metadata: {
        source: "api_key",
        created: result.summary.created,
        updated: result.summary.updated,
        duplicate: result.summary.duplicate,
        failed: result.summary.failed,
      },
    });

    return NextResponse.json(result);
  } catch {
    return jsonError("Internal server error", 500);
  }
}
