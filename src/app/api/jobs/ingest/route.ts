import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { ingestJobs } from "@/lib/ingestion/batch";
import { batchIngestionRequestSchema } from "@/lib/validations/batchIngestion";
import type { RawJobInput } from "@/lib/ingestion/types";
import { checkApiKey } from "@/lib/auth/apiKey";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

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

    return NextResponse.json(result);
  } catch {
    return jsonError("Internal server error", 500);
  }
}
